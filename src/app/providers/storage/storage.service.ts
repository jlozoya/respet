import { Injectable } from '@angular/core';

import { Events } from '@ionic/angular';
import { Storage } from '@ionic/storage';
import { User, UserRegistrationId, Address, Sesion } from '../models/models';

@Injectable()
export class StorageService {

  HAS_LOGGED_IN = 'respetHasLoggedIn';
  HAS_SEEN_TUTORIAL = 'respetHasSeenTutorial';
  USER = 'respetUser';
  SESION_STATE = 'respetSesionState';
  SESION_TOKEN = 'respetSesionToken';
  REGISTRATION_ID = 'respetRegistrationId';
  LANG = 'respetLang';

  constructor(
    public events: Events,
    public storage: Storage
  ) {}
  /**
   * Estable el id del usuario para recibir notificaciones push personalizadas.
   * @param {UserRegistrationId} userRegistrationId
   */
  setUserRegistrationId(userRegistrationId: UserRegistrationId) {
    this.storage.set(this.REGISTRATION_ID, userRegistrationId);
  }
  /**
   * Recupera id del usuario para recibir notificaciones push personalizadas.
   * @return {UserRegistrationId} userRegistrationId
   */
  async getUserRegistrationId(): Promise<UserRegistrationId>  {
    return await this.storage.get(this.REGISTRATION_ID).then((userRegistrationId: UserRegistrationId) => {
      return (userRegistrationId) ? userRegistrationId : null;
    });
  }
  /**
   * Almacena los correspondientes al usuario, para poder ustilizar en la aplicación.
   * @param {User} user
   */
  setCredentials(user: User): Promise<any> {
    this.storage.set(this.SESION_STATE, true);
    this.events.publish('user:login', user);
    return this.setUser(user);
  }
  /**
   * Almacena la información del usuario.
   * @param {User} user
   */
  setUser(user: User): Promise<any> {
    return this.storage.set(this.USER, user);
  }
  /**
   * Devuelve la información del usuario almacenado
   * @return {Promise<User>} user
   */
  async getUser(): Promise<User> {
    return await this.storage.get(this.USER).then((user: User) => {
      return (user) ? user : null;
    });
  }
  /**
   * Almacena el tipo de usuario.
   * @param {'visitor' | 'user'| 'admin' | 'other'} role
   */
  setUserRole(role: 'visitor' | 'user'| 'admin' | 'other'): void {
    this.storage.get(this.USER).then((user: User) => {
      user.role = role;
      this.storage.set(this.USER, user);
    });
  }
  /**
   * Devuelve el tipo de usuario.
   * @return {Promise<'visitor' | 'user'| 'admin' | 'other'>} role.
   */
  async getUserRole(): Promise<'visitor' | 'user'| 'admin' | 'other'> {
    return await this.storage.get(this.USER).then((user: User) => {
      return (user) ? user.role : null;
    });
  }
  /**
   * Almacena el id del usuario
   * @param {number} userId
   */
  setId(userId: number): void {
    this.storage.get(this.USER).then((user: User) => {
      user.id = userId;
      this.storage.set(this.USER, user);
    });
  }
  /**
   * Devuelve la id del usuario almacenado
   * @return {Promise<number>} Id
   */
  async getId(): Promise<number> {
    return await this.storage.get(this.USER).then((user: User) => {
      return (user) ? user.id : null;
    });
  }
  /**
   * Almacena la sesión del usuario
   * @param {Sesion} sesion
   */
  async setSesion(sesion: Sesion): Promise<boolean> {
    return await this.storage.set(this.SESION_TOKEN, sesion).then(() => {
      return true;
    });
  }
  /**
   * Devuelve el token del usuario almacenado
   * @return {Promise<string>} token
   */
  async getAccessToken(): Promise<string> {
    return await this.storage.get(this.SESION_TOKEN).then((sesion: Sesion) => {
      return (sesion) ? sesion.access_token : null;
    });
  }
  /**
   * Almacena el nombre del usuario
   * @param {string} name Nombre del usuario
   */
  setName(name: string): void {
    this.storage.get(this.USER).then((user: User) => {
      user.name = name;
      this.storage.set(this.USER, user);
    });
  }
  /**
   * Devuelve el nombre de usuario almacenado
   * @return {Promise<string>} Nombre de usuario
   */
  async getName(): Promise<string> {
    return await this.storage.get(this.USER).then((user: User) => {
      return (user) ? user.name : null;
    });
  }
  /**
   * Almacena el nombre del usuario
   * @param {string} first_name Nombre del usuario
   */
  setFirstName(first_name: string): void {
    this.storage.get(this.USER).then((user: User) => {
      user.first_name = first_name;
      this.storage.set(this.USER, user);
    });
  }
  /**
   * Devuelve el nombre de usuario almacenado
   * @return {Promise<string>} Primer nombre del usuario
   */
  async getFirstName(): Promise<string> {
    return this.storage.get(this.USER).then((user: User) => {
      return (user) ? user.first_name : null;
    });
  }
  /**
   * Almacena el nombre del usuario.
   * @param {string} last_name Apellido del usuario
   */
  setLastName(last_name: string): void {
    this.storage.get(this.USER).then((user: User) => {
      user.last_name = last_name;
      this.storage.set(this.USER, user);
    });
  }
  /**
   * Devuelve el nombre de usuario almacenado
   * @return {Promise<string>} Apellido del usuario
   */
  async getLastName(): Promise<string> {
    return await this.storage.get(this.USER).then((user: User) => {
      return (user) ? user.last_name : null;
    });
  }
  /**
   * Almacena el nombre del usuario.
   * @param {string} gender Nombre del usuario
   */
  setGender(gender: 'male' | 'female' | 'other' | null): void {
    this.storage.get(this.USER).then((user: User) => {
      user.gender = gender;
      this.storage.set(this.USER, user);
    });
  }
  /**
   * Devuelve el nombre de usuario almacenado.
   * @return {Promise<string>} Nombre de usuario.
   */
  async getGender(): Promise<string> {
    return await this.storage.get(this.USER).then((user: User) => {
      return (user) ? user.gender : null;
    });
  }
  /**
   * Almacena el número de teléfono del usuario.
   * @param {string} phone Número de teléfono del usuario
   */
  setPhoneNumber(phone: string): void {
    this.storage.get(this.USER).then((user: User) => {
      user.phone = phone;
      this.storage.set(this.USER, user);
    });
  }
  /**
   * Devuelve el número de teléfono de usuario almacenado.
   * @return {Promise<string>} Número de teléfono de usuario.
   */
  async getPhoneNumber(): Promise<string> {
    return await this.storage.get(this.USER).then((user: User) => {
      return (user) ? user.phone : null;
    });
  }
  /**
   * Almacena dirección del usuario
   * @param {Address} address Drección del usuario.
   */
  setAddress(address: Address): void {
    this.storage.get(this.USER).then((user: User) => {
      user.address = address;
      this.storage.set(this.USER, user);
    });
  }
  /**
   * Devuelve la dirección del usuario.
   * @return {Promise<Address>} Dirección del usuario.
   */
  async getAddress(): Promise<Address> {
    return await this.storage.get(this.USER).then((user: User) => {
      return (user) ? user.address : null;
    });
  }
  /**
   * Almacena la fecha de cumpleaños del usuario
   * @param {string} birthday Fecha de cumpleaños del usuario
   */
  setBirthday(birthday: string): void {
    this.storage.get(this.USER).then((user: User) => {
      user.birthday = birthday;
      this.storage.set(this.USER, user);
    });
  }
  /**
   * Devuelve la fecha de cumpleaños del usuario
   * @return {Promise<string>} Fecha de cumpleaños del usuario
   */
  async getBirthday(): Promise<string> {
    return await this.storage.get(this.USER).then((user: User) => {
      return (user) ? user.birthday : null;
    });
  }
  /**
   * Almacena el email del usuario.
   * @param {string} email
   */
  setEmail(email: string): void {
    this.storage.get(this.USER).then((user: User) => {
      user.email = email;
      this.storage.set(this.USER, user);
    });
  }
  /**
   * Devuelve el email del usuario almacenado.
   * @return {Promise<string>} Email.
   */
  async getEmail(): Promise<string> {
    return await this.storage.get(this.USER).then((user: User) => {
      return (user) ? user.email : null;
    });
  }
  /**
   * Devuelve la url de la imagen del usuario.
   * @return {Promise<string>} url.
   */
  async getImgUrl(): Promise<string> {
    return await this.storage.get(this.USER).then((user: User) => {
      return (user.media) ? user.media.url : null;
    });
  }
  /**
   * Almacena el url donde está la imagen de perfil del usuario.
   * @param {string} url
   */
  setImgUrl(url: string): void {
    this.storage.get(this.USER).then((user: User) => {
      user.media.url = url;
      this.storage.set(this.USER, user);
    });
  }
  /**
   * Devuelve la funte desde donde se esta conectando el usuario almacenado.
   * @return {Promise<string>} grant_type.
   */
  async getGrantType(): Promise<string> {
    return await this.storage.get(this.USER).then((user: User) => {
      return (user) ? user.grant_type : null;
    });
  }
  /**
   * Almacena la fuente desde donde se conecta el usuario.
   * @param {string} grantType
   */
  setGrantType(grantType: 'password' | 'facebook' | 'google' | 'other'): void {
    this.storage.get(this.USER).then((user: User) => {
      user.grant_type = grantType;
      this.storage.set(this.USER, user);
    });
  }
  /**
   * Devuelve el estado de la sesión.
   * @return {Promise<boolean>} Estado de la sesión.
   */
  async isLoged(): Promise<boolean> {
    return await this.storage.get(this.SESION_STATE).then((value) => {
      return value === true;
    });
  }
  /**
   * Emite el evento para indicar que el usuario se registró.
   * @param {User} user
   */
  signup(user: User): void {
    this.storage.set(this.HAS_LOGGED_IN, true);
    this.setUser(user);
    this.events.publish('user:signup');
  }
  /**
   * Cierra la sesión del usuario.
   */
  logout(): void {
    this.storage.remove(this.HAS_LOGGED_IN);
    this.storage.remove(this.USER);
    this.storage.remove(this.SESION_STATE);
    this.storage.remove(this.SESION_TOKEN);
    this.events.publish('user:logout');
  }
  /**
   * Almacena el idioma selecionado por el usuario.
   * @param lang Nombre del usuario
   */
  setLang(lang: string, upload = true): void {
    this.storage.set(this.LANG, lang);
    this.events.publish('user:lang', lang, upload);
  }
  /**
   * Devuelve el idioma selecionado por el usuario.
   * @return {Promise<string>} Nombre de usuario.
   */
  async getLang(): Promise<string> {
    return await this.storage.get(this.LANG).then((value) => {
      return value;
    });
  }
  async hasLoggedIn(): Promise<boolean> {
    return await this.storage.get(this.HAS_LOGGED_IN).then((value) => {
      return value === true;
    });
  }
  /**
   * Revisa si el usuario ha visualizado la introducción.
   * @return {Promise<boolean>} Si ha visto el tutorial.
   */
  async checkHasSeenTutorial(): Promise<boolean> {
    return await this.storage.get(this.HAS_SEEN_TUTORIAL).then((hasSeenTutorial: boolean) => {
      return hasSeenTutorial;
    });
  }
  /**
   * Establece si el usuario ha visto el tutorial
   * @return {boolean} Si ha visto el tutorial.
   */
  setHasSeenTutorial(hasSeenTutorial: boolean): void {
    this.storage.set(this.HAS_SEEN_TUTORIAL, hasSeenTutorial);
  }
}
