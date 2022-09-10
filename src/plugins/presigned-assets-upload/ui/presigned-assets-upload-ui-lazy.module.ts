import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '@vendure/admin-ui/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AssetListComponent } from './components/asset-list/asset-list.component';
import { Asset } from './generated-types';

@NgModule({
    imports: [
        SharedModule,
        RouterModule.forChild([
            {
                path: '',
                pathMatch: 'full',
                component: AssetListComponent,
                data: {
                    breadcrumb: [
                        {
                            label: 'Assets',
                            link: ['/extensions', 'assets'],
                        },
                    ],
                },
            },
        ]),
    ],
    declarations: [AssetListComponent],
    providers: [],
})
export class PresignedAssetsUploadUiLazyModule {}

export function exampleDetailBreadcrumb(resolved: { entity: Observable<Asset> }): any {
    return resolved.entity.pipe(
        map((entity) => [
            {
                label: 'Assets',
                link: ['/extensions', 'assets'],
            },
            {
                label: `${entity.id}`,
                link: [],
            },
        ]),
    );
}
