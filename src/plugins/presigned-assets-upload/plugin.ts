import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { adminApiSchema } from './api/api-extensions';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { PluginInitOptions } from './types';
import { AssetResolver } from './api/asset.resolver';
import { AssetService } from './service/asset.service';

@VendurePlugin({
    imports: [PluginCommonModule],
    adminApiExtensions: {
        schema: adminApiSchema,
        resolvers: [AssetResolver],
    },
    providers: [
        AssetService,
        { provide: PLUGIN_INIT_OPTIONS, useFactory: () => PresignedAssetsUploadPlugin.options },
    ],
})
export class PresignedAssetsUploadPlugin {
    static options: PluginInitOptions;

    /**
     * The static `init()` method is a convention used by Vendure plugins which allows options
     * to be configured by the user.
     */
    static init(options: PluginInitOptions): Type<PresignedAssetsUploadPlugin> {
        this.options = options;
        return PresignedAssetsUploadPlugin;
    }

    static uiExtensions: AdminUiExtension = {
        extensionPath: path.join(__dirname, 'ui'),
        ngModules: [
            {
                type: 'shared' as const,
                ngModuleFileName: 'presigned-assets-upload-ui-extension.module.ts',
                ngModuleName: 'PresignedAssetsUploadUiExtensionModule',
            },
            {
                type: 'lazy' as const,
                route: 'assets',
                ngModuleFileName: 'presigned-assets-upload-ui-lazy.module.ts',
                ngModuleName: 'PresignedAssetsUploadUiLazyModule',
            },
        ],
    };
}
