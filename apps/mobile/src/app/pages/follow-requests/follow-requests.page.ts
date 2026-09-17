import { ChangeDetectionStrategy, Component, type OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import type { FollowRequest } from '@respet/shared';

import { UsersService } from '../../core/api/users.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { FullNamePipe } from '../../shared/pipes/full-name.pipe';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';

/** Solicitudes de seguimiento de una cuenta privada, con «Confirmar» y «Eliminar». */
@Component({
  selector: 'app-follow-requests',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, IonContent, IonButton, IonIcon, IonSpinner, PageHeaderComponent, AvatarComponent, FullNamePipe, RelativeTimePipe],
  template: `
    <app-page-header title="NAV.FOLLOW_REQUESTS" />

    <ion-content>
      <div class="rs-container narrow">
        <section class="rs-card">
          <h2 class="rs-card-title rs-desktop-only">{{ 'NAV.FOLLOW_REQUESTS' | translate }}</h2>
          @for (request of requests(); track request.id) {
            <div class="request">
              <a [routerLink]="['/profile', request.requester.name]"><app-avatar [user]="request.requester" [size]="60" /></a>
              <div class="info">
                <a class="rs-strong" [routerLink]="['/profile', request.requester.name]">{{ request.requester | fullName }}</a>
                <span class="rs-small rs-muted">&#64;{{ request.requester.name }} · {{ request.createdAt | relativeTime }}</span>
                <div class="actions">
                  <ion-button size="small" (click)="respond(request, true)">{{ 'FOLLOW.CONFIRM' | translate }}</ion-button>
                  <ion-button size="small" class="rs-soft" (click)="respond(request, false)">{{ 'DELETE' | translate }}</ion-button>
                </div>
              </div>
            </div>
          } @empty {
            @if (loading()) {
              <div class="rs-empty"><ion-spinner /></div>
            } @else {
              <div class="rs-empty">
                <ion-icon name="person-add-outline" />
                <p>{{ 'FOLLOW.NO_REQUESTS' | translate }}</p>
              </div>
            }
          }
        </section>
      </div>
    </ion-content>
  `,
  styles: `
    .request {
      align-items: center;
      display: flex;
      gap: 12px;
      padding: 8px 16px;
    }

    .info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .actions {
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }
  `,
})
export class FollowRequestsPage implements OnInit {
  private readonly users = inject(UsersService);
  private readonly feedback = inject(FeedbackService);

  readonly requests = signal<FollowRequest[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      const page = await this.users.followRequests({ perPage: 50 });
      this.requests.set(page.data);
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.loading.set(false);
    }
  }

  async respond(request: FollowRequest, accept: boolean): Promise<void> {
    this.requests.update((items) => items.filter((item) => item.id !== request.id));

    try {
      if (accept) {
        await this.users.acceptFollowRequest(request.id);
      } else {
        await this.users.rejectFollowRequest(request.id);
      }
    } catch (error) {
      this.requests.update((items) => [request, ...items]);
      await this.feedback.error(error);
    }
  }
}
