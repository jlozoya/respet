import { environment } from './../../../environments/environment';
import { ActivatedRoute, Router } from '@angular/router';
import { Component } from '@angular/core';

@Component({
  selector: 'app-error',
  templateUrl: './error.page.html',
  styleUrls: ['./error.page.scss'],
})
export class ErrorPage {

  error = {
    title: 'ERRORS_PAGE.NOT_FOUND.TITLE',
    code: '404',
    message: 'ERRORS_PAGE.NOT_FOUND.MESSAGE'
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ionViewDidEnter() {
    this.route.params.subscribe((params) => {
      if (params.error) {
        switch (params.error) {
          case '400': {
            this.error = {
              title: 'ERRORS_PAGE.SOMETHING_WENT_WRONG.TITLE',
              code: '400',
              message: 'ERRORS_PAGE.SOMETHING_WENT_WRONG.MESSAGE'
            };
          } break;
          case '404': {
            this.error = {
              title: 'ERRORS_PAGE.NOT_FOUND.TITLE',
              code: '404',
              message: 'ERRORS_PAGE.NOT_FOUND.MESSAGE'
            };
          } break;
          case '406': {
            this.error = {
              title: 'ERRORS_PAGE.UNAUTHORIZED.TITLE',
              code: '406',
              message: 'ERRORS_PAGE.UNAUTHORIZED.MESSAGE'
            };
          } break;
        }
      }
    });
  }

  goToMain() {
    this.router.navigate([environment.MAIN_URL]);
  }
}
