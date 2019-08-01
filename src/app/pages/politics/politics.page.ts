import { IonContent } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { Component, ViewChild, OnInit } from '@angular/core';

@Component({
  selector: 'app-politics',
  templateUrl: 'politics.page.html',
  styleUrls: ['politics.page.scss']
})
export class PoliticsPage implements OnInit {

  segment = 'end_user_agreement';
  @ViewChild(IonContent, {static: false}) content: IonContent;

  constructor(
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.segment = params.segment || 'end_user_agreement';
    });
  }

  /**
   * Cambia el segmento donde se encuentra.
   * @param {string} segment
   */
  async changeTo(segment: string) {
    this.segment = segment;
    this.content.scrollToPoint(0, 0, 1000);
  }
  /**
   * Navega hacia el componente que corresponda
   * @param {string} elementId
   */
  async scrollTo(elementId: string) {
    this.content.scrollToPoint(0, document.getElementById(elementId).offsetTop, 1000);
  }
}
