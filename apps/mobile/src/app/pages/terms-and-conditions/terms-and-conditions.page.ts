import { ChangeDetectionStrategy, Component, input, signal, viewChild } from '@angular/core';
import { IonContent } from '@ionic/angular/ion-content';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonSegment } from '@ionic/angular/ion-segment';
import { IonSegmentButton } from '@ionic/angular/ion-segment-button';
import { TranslatePipe } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../shared/components/page-header.component';

const SECTIONS = ['terms', 'conditions', 'liability'] as const;

type Section = (typeof SECTIONS)[number];

@Component({
  selector: 'app-terms-and-conditions',
  templateUrl: 'terms-and-conditions.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    PageHeaderComponent,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
  ],
})
export class TermsAndConditionsPage {
  readonly segment = input<string>('terms');

  private readonly content = viewChild.required(IonContent);

  readonly sections = SECTIONS;
  readonly current = signal<Section>('terms');

  constructor() {
    const initial = this.segment();

    if ((SECTIONS as readonly string[]).includes(initial)) {
      this.current.set(initial as Section);
    }
  }

  changeTo(section: string): void {
    if (!(SECTIONS as readonly string[]).includes(section)) {
      return;
    }

    this.current.set(section as Section);
    void this.content().scrollToTop(300);
  }
}
