import { Inject, Injectable } from '@nestjs/common';
import { notNullOrUndefined } from '@vendure/common/lib/shared-utils';
import mime from 'mime-types';
import path from 'path';

import { PLUGIN_INIT_OPTIONS } from '../constants';
import { PluginInitOptions } from '../types';
import { PresignedPost } from 'aws-sdk/lib/s3/presigned_post';
import { S3 } from 'aws-sdk';
import {
    Asset, AssetEvent, AssetType,
    ChannelService,
    ConfigService, CustomFieldRelationService,
    EventBus, getAssetType, isGraphQlErrorResult, Logger, MimeTypeError, RequestContext,
    TagService,
    TransactionalConnection
} from '@vendure/core';

// tslint:disable-next-line:no-var-requires
const sizeOf = require('image-size');

@Injectable()
export class AssetService {
    private permittedMimeTypes: Array<{ type: string; subtype: string }> = [];
    private s3: S3;

    constructor(
        @Inject(PLUGIN_INIT_OPTIONS) private options: PluginInitOptions,
        private connection: TransactionalConnection,
        private configService: ConfigService,
        private eventBus: EventBus,
        private tagService: TagService,
        private channelService: ChannelService,
        private customFieldRelationService: CustomFieldRelationService,
    ) {
        this.permittedMimeTypes = this.configService.assetOptions.permittedFileTypes
            .map(val => (/\.[\w]+/.test(val) ? mime.lookup(val) || undefined : val))
            .filter(notNullOrUndefined)
            .map(val => {
                const [type, subtype] = val.split('/');
                return { type, subtype };
            });

        this.s3 =  new S3({
            credentials: {
                accessKeyId: this.options.accessKeyId,
                secretAccessKey: this.options.secretAccessKey,
            },
            region: 'eu-central-1',
        });
    }

    async createPresignedPost(ctx: RequestContext, filename: string): Promise<PresignedPost> {
        const params: S3.PresignedPost.Params = {
            Bucket: this.options.bucketName,
            Fields: {
                key: await this.getSourceFileName(ctx, filename)
            },
            Expires: 300,
            Conditions: [
                ["content-length-range", 0, 10524288]
            ]
        };

        return this.s3.createPresignedPost(params)
    }

    async create(ctx: RequestContext, input:any): Promise<any> {
        return new Promise(async (resolve, reject) => {

            let result: Asset | MimeTypeError;
            try {
                result = await this.createAssetInternal(ctx, input.filename, input.customFields);
            } catch (e) {
                reject(e);
                return;
            }
            if (isGraphQlErrorResult(result)) {
                resolve(result);
                return;
            }
            await this.customFieldRelationService.updateRelations(ctx, Asset, input, result);
            if (input.tags) {
                result.tags = await this.tagService.valuesToTags(ctx, input.tags);
                await this.connection.getRepository(ctx, Asset).save(result);
            }
            this.eventBus.publish(new AssetEvent(ctx, result, 'created', input));
            resolve(result);
        });
    }

    private async createAssetInternal(
        ctx: RequestContext,
        filename: string,
        customFields?: { [key: string]: any },
    ): Promise<Asset | MimeTypeError> {
        const { assetOptions } = this.configService;
        // TODO Where should mimetype checking be handled? first request on AWS or rather here? Or maybe both?
        // if (!this.validateMimeType(mimetype)) {
        //     return new MimeTypeError(filename, mimetype);
        // }
        const { assetPreviewStrategy, assetStorageStrategy } = assetOptions;
        const sourceFileName = filename;
        const previewFileName = await this.getPreviewFileName(ctx, sourceFileName);

        const sourceFile = await assetStorageStrategy.readFileToBuffer(sourceFileName);
        // TODO This should be handled directly, i dont want to guess mime from buffer, so best solution is to get this from aws
        const mimetype = mime.lookup(sourceFileName) || 'application/json';
        let preview: Buffer;
        try {
            preview = await assetPreviewStrategy.generatePreviewImage(ctx, mimetype, sourceFile);
        } catch (e) {
            Logger.error(`Could not create Asset preview image: ${e.message}`, undefined, e.stack);
            throw e;
        }

        const previewFileIdentifier = await assetStorageStrategy.writeFileFromBuffer(
            previewFileName,
            preview,
        );
        const type = getAssetType(mimetype);
        const { width, height } = this.getDimensions(type === AssetType.IMAGE ? sourceFile : preview);


        const asset = new Asset({
            type,
            width,
            height,
            name: path.basename(sourceFileName),
            fileSize: sourceFile.byteLength,
            mimeType: mimetype,
            source: sourceFileName,
            preview: previewFileIdentifier,
            focalPoint: null,
            customFields,
        });
        await this.channelService.assignToCurrentChannel(asset, ctx);
        return this.connection.getRepository(ctx, Asset).save(asset);
    }

    private async getSourceFileName(ctx: RequestContext, fileName: string): Promise<string> {
        const { assetOptions } = this.configService;

        return this.generateUniqueName(fileName, (name, conflict) =>
            assetOptions.assetNamingStrategy.generateSourceFileName(ctx, name, conflict),
        );
    }

    private async getPreviewFileName(ctx: RequestContext, fileName: string): Promise<string> {
        const { assetOptions } = this.configService;
        return this.generateUniqueName(fileName, (name, conflict) =>
            assetOptions.assetNamingStrategy.generatePreviewFileName(ctx, name, conflict),
        );
    }

    private async generateUniqueName(
        inputFileName: string,
        generateNameFn: (fileName: string, conflictName?: string) => string,
    ): Promise<string> {
        const { assetOptions } = this.configService;
        let outputFileName: string | undefined;
        do {
            outputFileName = generateNameFn(inputFileName, outputFileName);
        } while (await assetOptions.assetStorageStrategy.fileExists(outputFileName));
        return outputFileName;
    }

    private getDimensions(imageFile: Buffer): { width: number; height: number } {
        try {
            const { width, height } = sizeOf(imageFile);
            return { width, height };
        } catch (e) {
            Logger.error(`Could not determine Asset dimensions: ` + e);
            return { width: 0, height: 0 };
        }
    }


    private validateMimeType(mimeType: string): boolean {
        const [type, subtype] = mimeType.split('/');
        const typeMatches = this.permittedMimeTypes.filter(t => t.type === type);

        for (const match of typeMatches) {
            if (match.subtype === subtype || match.subtype === '*') {
                return true;
            }
        }
        return false;
    }

}
