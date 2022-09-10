import { Injectable } from '@angular/core';
import {BaseDataService} from '@vendure/admin-ui/core'
import { CreateExistingAssetInput, CreateExistingAssets, CreatePresignedPost } from '../generated-types';
import { CREATE_EXISTING_ASSETS, CREATE_PRESIGNED_POST } from './presigned-upload.graphql';

@Injectable({
    providedIn: 'root',
})
export class PresignedUploadService {
    constructor(private baseDataService: BaseDataService) {}


    createPresignedPost(filename: string) {
        return this.baseDataService.mutate<CreatePresignedPost.Mutation, CreatePresignedPost.Variables>(CREATE_PRESIGNED_POST, {
            filename
        });
    }

    createExistingAssets(input: CreateExistingAssetInput[]) {
        return this.baseDataService.mutate<CreateExistingAssets.Mutation, CreateExistingAssets.Variables>(CREATE_EXISTING_ASSETS, {
            input
        });
    }

}
