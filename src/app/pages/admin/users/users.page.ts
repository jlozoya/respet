import { Router } from '@angular/router';
import { Component  } from '@angular/core';
import { ApiService, User, Pagination } from '../../../providers/providers';

@Component({
  selector: 'app-users',
  templateUrl: 'users.page.html',
  styleUrls: ['users.page.scss']
})
export class UsersPage {

  users: User[] = [];
  lastPage = 1;
  search = '';

  constructor(
    private router: Router,
    private api: ApiService
  ) {
  }

  ionViewDidEnter() {
    this.getUsers();
  }
  /**
   * Recupera la información de los usuarios.
   * @param {number} page
   * @param {string} search
   * @return {Promise<boolean>} Regresa verdadero en caso de obtener más información y false en caso de obtener un error.
   */
  getUsers(page: number = 1, search: string = ''): Promise<boolean> {
    return new Promise(result => {
      this.lastPage = page;
      this.api.get(`/users?page=${page}&search=${search}`, ).then((response: Pagination) => {
        if (page === 1) {
          this.users = response.data;
        } else {
          response.data.map((user) => {
            this.users.push(user);
          });
        }
        result(true);
      }, (fail) => {
        console.log('[users-40]', fail);
        result(false);
      });
    });
  }
  /**
   * Navega hacia la página de detalles del usuario.
   * @param {User} user
   */
  goToUserDetail(user: User) {
    this.router.navigate(['/account', user.id]);
  }
  /**
   * Actualiza las variables para realizar una búsqueda
   */
  onSearch() {
    this.lastPage = 1;
    this.getUsers(this.lastPage, this.search);
  }
  /**
   * Refresca la página.
   * @param event
   */
  doRefresh(event) {
    this.getUsers().then(() => {
      event.target.complete();
    });
  }
  /**
   * Llama a la función para cargar mas elementos cuando la página llega al final.
   * @param infiniteScroll
   */
  doScrollDown(infiniteScroll) {
    this.getUsers(this.lastPage + 1, this.search).then(() => {
      infiniteScroll.target.complete();
    });
  }
}
