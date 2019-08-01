import { Router } from '@angular/router';
import { ApiService, Pagination, Bulletin } from './../../providers/providers';
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-bulletin',
  templateUrl: './bulletin.component.html',
  styleUrls: ['./bulletin.component.scss']
})
export class BulletinComponent implements OnInit {

  bulletins: Bulletin[] = [];

  constructor(
    private router: Router,
    private api: ApiService
  ) { }
  /**
   * Al cargar el componenete.
   */
  ngOnInit() {
    this.getBulletins();
  }
  /**
   * Obtiene las ultimas noticias publicadas.
   */
  getBulletins() {
    return new Promise(async (finish) => {
      const pages: Pagination = await this.api.get('/bulletins').catch((error) => {
        console.log('[bulletin-30]', error);
      });
      this.bulletins = (pages) ? pages.data : [];
      finish();
    });
  }
  /**
   * Refresca la página.
   * @param event
   */
  async doRefresh(event) {
    await this.getBulletins();
    event.target.complete();
  }
  /**
   * Abre la página para ver mas.
   */
  seeMore() {
    this.router.navigate(['/bulletins']);
  }
}
