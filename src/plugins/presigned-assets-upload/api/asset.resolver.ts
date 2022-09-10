import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext, Transaction } from '@vendure/core';
import { CreateAssetResult, MutationCreateExistingAssetsArgs } from './generated-admin-types';
import { PresignedPost } from 'aws-sdk/clients/s3';
import { AssetService } from '../service/asset.service';


@Resolver('Asset')
export class AssetResolver {
    constructor(private assetService: AssetService) {}

    @Mutation()
    @Allow(Permission.CreateAsset)
    async createPresignedPost(
        @Ctx() ctx: RequestContext,
        @Args('filename') filename: string
        ): Promise<PresignedPost> {
        return this.assetService.createPresignedPost(ctx, filename);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.CreateCatalog, Permission.CreateAsset)
    async createExistingAssets(
        @Ctx() ctx: RequestContext,
        @Args() args: MutationCreateExistingAssetsArgs,
    ): Promise<CreateAssetResult[]> {
        // TODO: Is there some way to parellelize this while still preserving
        // the order of files in the upload? Non-deterministic IDs mess up the e2e test snapshots.
        const assets: CreateAssetResult[] = [];
        for (const input of args.input) {
            const asset = await this.assetService.create(ctx, input);
            assets.push(asset);
        }
        return assets;
    }

}
