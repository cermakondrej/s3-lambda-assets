import { NgModule } from '@angular/core';
import { SharedModule, addNavMenuSection } from '@vendure/admin-ui/core';

@NgModule({
    imports: [SharedModule],
    providers: [
        addNavMenuSection(
            {
                id: 'presigned-upload-assets',
                label: 'Assets',
                items: [
                    {
                        id: 'presigned-upload-assets',
                        label: 'Assets',
                        routerLink: ['/extensions/assets'],
                        icon: 'star',
                    },
                ],
            },
            'settings',
        ),
    ],
    exports: [],
})
export class PresignedAssetsUploadUiExtensionModule {}
