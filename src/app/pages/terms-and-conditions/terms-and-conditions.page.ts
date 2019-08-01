import { Component, ViewChild, AfterViewInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent } from '@ionic/angular';

@Component({
  selector: 'app-terms-and-conditions',
  templateUrl: 'terms-and-conditions.page.html',
  styleUrls: ['terms-and-conditions.page.scss']
})
export class TermsAndConditionsPage implements AfterViewInit {

  segment = '';
  @ViewChild(IonContent, {static: false}) content: IonContent;

  constructor(
    private route: ActivatedRoute
  ) {
  }

  ngAfterViewInit(): void {
    this.route.params.subscribe((params) => {
      this.segment = params.segment;
    });
  }

  /**
   * Navega hacia el componente que corresponda
   * @param {string} elementId
   */
  scrollTo(elementId: string) {
    this.content.scrollToPoint(0, document.getElementById(elementId).offsetTop, 1000);
  }
}
