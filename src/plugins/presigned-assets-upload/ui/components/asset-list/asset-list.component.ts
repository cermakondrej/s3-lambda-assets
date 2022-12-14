import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { marker as _ } from '@biesbjerg/ngx-translate-extract-marker';
import {
    Asset,
    BaseListComponent,
    DataService,
    DeletionResult,
    GetAssetList,
    LogicalOperator,
    ModalService,
    NotificationService,
    SortOrder,
    TagFragment,
} from '@vendure/admin-ui/core';
import { PaginationInstance } from 'ngx-pagination';
import { BehaviorSubject, combineLatest, EMPTY, Observable } from 'rxjs';
import { debounceTime, map, switchMap, takeUntil, finalize } from 'rxjs/operators';
import { PresignedUploadService } from '../../providers/presigned-upload.service';

@Component({
    selector: 'vdr-asset-list-new',
    templateUrl: './asset-list.component.html',
    styleUrls: ['./asset-list.component.scss'],
})
export class AssetListComponent
    extends BaseListComponent<GetAssetList.Query, GetAssetList.Items, GetAssetList.Variables>
    implements OnInit {
    searchTerm$ = new BehaviorSubject<string | undefined>(undefined);
    filterByTags$ = new BehaviorSubject<TagFragment[] | undefined>(undefined);
    uploading = false;
    allTags$: Observable<TagFragment[]>;
    paginationConfig$: Observable<PaginationInstance>;

    constructor(
        private notificationService: NotificationService,
        private modalService: ModalService,
        private dataService: DataService,
        private presignedUploadService: PresignedUploadService,
        router: Router,
        route: ActivatedRoute,
    ) {
        super(router, route);
        super.setQueryFn(
            (...args: any[]) => this.dataService.product.getAssetList(...args),
            data => data.assets,
            (skip, take) => {
                const searchTerm = this.searchTerm$.value;
                const tags = this.filterByTags$.value?.map(t => t.value);
                return {
                    options: {
                        skip,
                        take,
                        ...(searchTerm
                            ? {
                                filter: {
                                    name: {contains: searchTerm},
                                },
                            }
                            : {}),
                        sort: {
                            createdAt: SortOrder.DESC,
                        },
                        tags,
                        tagsOperator: LogicalOperator.AND,
                    },
                };
            },
            {take: 25, skip: 0},
        );
    }

    ngOnInit() {
        super.ngOnInit();
        this.paginationConfig$ = combineLatest(this.itemsPerPage$, this.currentPage$, this.totalItems$).pipe(
            map(([itemsPerPage, currentPage, totalItems]) => ({itemsPerPage, currentPage, totalItems})),
        );
        this.searchTerm$.pipe(debounceTime(250), takeUntil(this.destroy$)).subscribe(() => this.refresh());

        this.filterByTags$.pipe(takeUntil(this.destroy$)).subscribe(() => this.refresh());
        this.allTags$ = this.dataService.product.getTagList().mapStream(data => data.tags.items);
    }

    // The only changed method in this class
    filesSelected(files: File[]) {
        if (files.length) {
            this.uploading = true;

            files.forEach((file) => {
                this.presignedUploadService.createPresignedPost(file.name).subscribe(({createPresignedPost}) => {
                    let form = new FormData();
                    Object.keys(createPresignedPost.fields).forEach(key => form.append(key, createPresignedPost.fields[key]));
                    form.append('file', file);
                    fetch(createPresignedPost.url, {method: 'POST', body: form}).then((res) => {
                        this.presignedUploadService.createExistingAssets([{filename: createPresignedPost.fields['key']}])
                            .subscribe(({createExistingAssets}) => {
                                let successCount = 0;
                                for (const result of createExistingAssets) {
                                    switch (result.__typename) {
                                        case 'Asset':
                                            successCount++;
                                            break;
                                        case 'MimeTypeError':
                                            this.notificationService.error(result.message);
                                            break;
                                    }
                                }
                                if (0 < successCount) {
                                    super.refresh();
                                    this.notificationService.success(_('asset.notify-create-assets-success'), {
                                        count: successCount,
                                    });
                                }
                            })
                    });
                });
            });

            this.uploading = false;


        }
    }

    deleteAssets(assets: Asset[]) {
        this.showModalAndDelete(assets.map(a => a.id))
            .pipe(
                switchMap(response => {
                    if (response.result === DeletionResult.DELETED) {
                        return [true];
                    } else {
                        return this.showModalAndDelete(
                            assets.map(a => a.id),
                            response.message || '',
                        ).pipe(map(r => r.result === DeletionResult.DELETED));
                    }
                }),
            )
            .subscribe(
                () => {
                    this.notificationService.success(_('common.notify-delete-success'), {
                        entity: 'Assets',
                    });
                    this.refresh();
                },
                err => {
                    this.notificationService.error(_('common.notify-delete-error'), {
                        entity: 'Assets',
                    });
                },
            );
    }

    private showModalAndDelete(assetIds: string[], message?: string) {
        return this.modalService
            .dialog({
                title: _('catalog.confirm-delete-assets'),
                translationVars: {
                    count: assetIds.length,
                },
                body: message,
                buttons: [
                    {type: 'secondary', label: _('common.cancel')},
                    {type: 'danger', label: _('common.delete'), returnValue: true},
                ],
            })
            .pipe(
                switchMap(res => (res ? this.dataService.product.deleteAssets(assetIds, !!message) : EMPTY)),
                map(res => res.deleteAssets),
            );
    }
}
