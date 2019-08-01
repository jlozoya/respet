import { Media } from './../models/models';
import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { Platform, ActionSheetController } from '@ionic/angular';

import { File } from '@ionic-native/file/ngx';
import { FilePath } from '@ionic-native/file-path/ngx';
import { Camera, CameraOptions, PictureSourceType } from '@ionic-native/camera/ngx';

import { ApiService } from './../api/api.service';
import { TranslateService } from '@ngx-translate/core';

/**
 * Modulo para subir imágenes al servidor.
 */
@Injectable()
export class TransferImgFileService {

  constructor(
    private platform: Platform,
    private camera: Camera,
    private file: File,
    private filePath: FilePath,
    private actionSheetCtrl: ActionSheetController,
    private translate: TranslateService,
    private api: ApiService
  ) {}

  /**
   * Obtiene la imagen de cualquier fuente según la plataforma.
   * @param {string} img Opcional en caso de estar utilizando un input file.
   * @return {Promise<string>} Regresa la dirección de la imagen correspondiente
   * según el dispositivo.
   */
  public getImg(img?: string): Promise<string> {
    return new Promise((imgUrl, reject) => {
      if (this.platform.is('android') || this.platform.is('ios')) {
        this.mobileSelectPicture().then((imgUri) => {
          imgUrl(imgUri);
        }, (fail) => {
          console.log('[transfer-img-file-41]', JSON.stringify(fail));
          reject(fail);
        });
      } else {
        this.getBased64Image(img).then((base64_img: string) => {
          imgUrl(base64_img);
        }, fail => {
          console.log('[transfer-img-file-48]', JSON.stringify(fail));
          reject(fail);
        });
      }
    });
  }

  public getMultipleBase64Imgs(files): Observable<Media> {
    return new Observable((result) => {
      const re = /\.png$|.jpg$|.jpeg$|.gif$/i;
      if (files.items) {
        for (let i = 0; i < files.items.length; i++) {
          if (files.items[i].kind === 'file') {
            const file = files.items[i].getAsFile();
            if (re.test(file.name)) {
              this.getBase64(file).then((imgBase64: string) => {
                result.next({ url: imgBase64, alt: file.name });
              }).catch((error) => {
                console.log('[transfer-img-file-66]', error);
              });
            }
          }
        }
      } else {
        for (let i = 0; i < files.length; i++) {
          if (re.test(files[i].name)) {
            this.getBase64(files[i]).then((imgBase64: string) => {
              result.next({ url: imgBase64, alt: files[i].name });
            }).catch((error) => {
              console.log('[transfer-img-file-77]', error);
            });
          }
        }
      }
    });
  }

  public getBase64(file): Promise<any> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  }
  /**
   * Proporciona al usuario la opción para subir una imagen que visualizara en su cuenta
   * y almacenara en el servidor.
   * @return {Promise<string>}
   */
  private mobileSelectPicture(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const actionSheet = await this.actionSheetCtrl.create({
        header: this.translate.instant('IMG.SHEET.TITLE'),
        buttons: [
          {
            text: this.translate.instant('IMG.SHEET.USE_LIBRARY'),
            handler: () => {
              this.takePicture(this.camera.PictureSourceType.PHOTOLIBRARY).then((success) => {
                resolve(success);
              }, (fail) => {
                reject(fail);
              });
            }
          },
          {
            text: this.translate.instant('IMG.SHEET.USE_CAMERA'),
            handler: () => {
              this.takePicture(this.camera.PictureSourceType.CAMERA).then((success) => {
                resolve(success);
              }, (fail) => {
                reject(fail);
              });
            }
          },
          {
            text: this.translate.instant('CANCEL'),
            role: 'cancel'
          }
        ]
      });
      await actionSheet.present();
    });
  }
  /**
   * Proporciona al usuario la interfaz para seleccionar o capturar una imagen y subirla al servidor.
   * @param sourceType Define de donde se extraerá la imagen.
   * @return {Promise<string>}
   */
  private takePicture(sourceType: PictureSourceType): Promise<string> {
    return new Promise((resolve, reject) => {
      // Crear las opciones para la pantalla de la cámara
      const options: CameraOptions = {
        quality: 80,
        sourceType: sourceType,
        saveToPhotoAlbum: false,
        correctOrientation: false
      };
      // Obtener los datos de la imagen
      this.camera.getPicture(options).then((imagePath) => {
        let correctPath: string;
        let currentName: string;
        // Manejo especial para la biblioteca de Android
        if (this.platform.is('android') && sourceType === this.camera.PictureSourceType.PHOTOLIBRARY) {
          // filePath solo funciona en android
          this.filePath.resolveNativePath(imagePath).then((filePath) => {
            correctPath = filePath.substr(0, filePath.lastIndexOf('/') + 1);
            currentName = filePath.substring(filePath.lastIndexOf('/') + 1, filePath.length);
            this.file.readAsDataURL(correctPath, currentName).then((imageBase64) => {
              resolve(imageBase64);
            });
          });
        } else {
          currentName = imagePath.substr(imagePath.lastIndexOf('/') + 1);
          correctPath = imagePath.substr(0, imagePath.lastIndexOf('/') + 1);
          this.file.readAsDataURL(correctPath, currentName).then((imageBase64) => {
            resolve(imageBase64);
          });
        }
      }, (error) => {
        console.log('[transfer-img-file-171]', JSON.stringify(error));
        reject(this.translate.instant('ERRORS.CAMERA_ERROR'));
      });
    });
  }
  /**
   * Genera una cadena aleatoria.
   * @param {number} length Numero de caracteres que se desean.
   * @return {string} Cadena aleatoria.
   */
  private makeRandomString(length: number): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
  /**
   * Si se agregó una imagen la sube.
   * @param {string} serverUrl
   * @param {string} imgUrl
   * @param {FileImgTransferOptions} options
   */
  public uploadImg(serverUrl: string, imgUrl: string,
    options?: FileImgTransferOptions): Promise<any> {
    return new Promise((response) => {
      this.uploadBased64Image(serverUrl, imgUrl, options).then(resolve => {
        response(resolve);
      }, fail => {
        response(fail);
      });
    });
  }

  /**
   * Obtiene la extensión del archivo.
   * @param {string} base64Data
   * @return Regresa la extensión del archivo.
   */
  private getFileExtension(filename): string {
    return filename.split('.').pop();
  }

  /**
   * Método para cargar imágenes en formato base64 desde un input file de un navegador.
   * @param event
   * @return {Promise<string>}
   */
  private getBased64Image(event): Promise<string | ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const file = event.srcElement.files[0];
      if (!(/\.(jpg|jpeg|png|gif)$/i).test(file.name)) {
        reject(this.translate.instant('ERRORS.FILE_NO_IMAGE'));
      } else {
        if (file.size > 4194304) {
          reject(this.translate.instant('ERRORS.FILE_MAX_4MG'));
        } else {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
            resolve(reader.result);
          };
        }
      }
    });
  }

  /**
   * Envía un put con la información de una imagen codificada en base64 al servidor.
   * @param {string} serverUrl
   * @param {string} base64Img
   * @param {string} fileName
   * @return {Promise<string>}
   */
  private uploadBased64Image(serverUrl: string, base64Img: string, options?: FileImgTransferOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      let fileName = '';
      let params = null;
      if (!options || !options.fileName) {
        const date = new Date().getTime();
        fileName = `${this.makeRandomString(20)}_${date}.${this.getFileExtensionBase64(base64Img)}`;
      } else {
        fileName = options.fileName;
      }
      if (options && options.params) {
        params = options.params;
      }
      const query = {
        file_name: fileName,
        file: base64Img,
        type: 'base64',
        params: params
      };
      try {
        this.api.put(serverUrl, query).then(response => {
          resolve(response);
        }, fail => {
          console.log('[transfer-img-file-269]', JSON.stringify(fail));
          reject(fail);
        });
      } catch (error) {
        console.log('[transfer-img-file-273]', JSON.stringify(error));
        reject(error);
      }
    });
  }

  /**
   * Obtiene la extensión del archivo para archivos con codificación base64.
   * @param {string} base64Data
   * @return Regresa la extensión del archivo.
   */
  private getFileExtensionBase64(base64Data): string {
    return base64Data.split(';')[0].split('/')[1];
  }
}

interface FileImgTransferOptions {
  fileName?: string;
  params?: any;
}
