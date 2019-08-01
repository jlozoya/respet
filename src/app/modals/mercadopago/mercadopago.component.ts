import { Component, OnInit } from '@angular/core';
import { ToastController, NavParams, LoadingController, ModalController } from '@ionic/angular';
import { ApiService, MercadopagoResponse } from '../../providers/providers';
import { TranslateService } from '@ngx-translate/core';

declare var Mercadopago: any;

/**
 * Genera un modal.
 * @author <a href="mailto:jlozoya1995@gmail.com">Juan Lozoya</a>
 * @see https://www.mercadopago.com.mx/developers/es/tools/sdk/client/javascript/
 */
@Component({
  selector: 'app-mercadopago',
  templateUrl: 'mercadopago.component.html',
  styleUrls: ['mercadopago.component.scss']
})
export class MercadopagoComponent implements OnInit {

  doSubmit = false;
  hasEuId = false;
  showSecurityCode = true;
  showInstallments = false;
  showIssuer = false;

  constructor(
    private modalCtrl: ModalController,
    private navParams: NavParams,
    private toastCtrl: ToastController,
    private translate: TranslateService,
    private loadingCtrl: LoadingController,
    private api: ApiService
  ) {
  }
  /**
   * O iniciar la vista ejecuta funciones de Mercadopago
   */
  ngOnInit() {
    Mercadopago.setPublishableKey('TEST-6c040dc1-b630-47ec-af75-dfbaed3b5b6e');
    Mercadopago.getIdentificationTypes();
    this.cardsHandler();
  }

  addEvent(element, eventName, handler) {
    if (element.addEventListener) {
      element.addEventListener(eventName, handler);
    } else {
      element.attachEvent('on' + eventName, () => {
        handler.call(element);
      });
    }
  }
  /**
   * Obtiene los primeros seis dígitos de la tarjeta
   */
  private getBin(): string {
    const cardSelector = <any>document.querySelector('#cardId');
    if (cardSelector && cardSelector[cardSelector.options.selectedIndex].value !== '-1') {
      return cardSelector[cardSelector.options.selectedIndex].getAttribute('first_six_digits');
    }
    const ccNumber = <HTMLInputElement>document.querySelector('input[data-checkout="cardNumber"]');
    return ccNumber.value.replace(/[ .-]/g, '').slice(0, 6);
  }

  clearOptions() {
    const bin = this.getBin();
    if (bin.length === 0) {
      const select = <HTMLSelectElement>document.querySelector('#issuer');
      select.style.display = 'none';
      document.querySelector('#issuer').innerHTML = '';
      const selectorInstallments = <HTMLSelectElement>document.querySelector('#installments'),
        fragment = document.createDocumentFragment(),
        option = new Option(this.translate.instant('MERCADOPAGO.CHOOSE'), '-1');
      selectorInstallments.options.length = 0;
      fragment.appendChild(option);
      selectorInstallments.appendChild(fragment);
      selectorInstallments.setAttribute('disabled', 'disabled');
    }
  }
  /**
   * Obtiene el método de pago
   *
   * @param event
   */
  guessingPaymentMethod(event) {
    const bin = this.getBin(),
      amount = (<HTMLInputElement>document.querySelector('#amount')).value;
    if (event.type === 'keyup') {
      if (bin.length === 6) {
        Mercadopago.getPaymentMethod({
          'bin': bin
        }, (status, response) => {
          this.setPaymentMethodInfo(status, response);
        });
      }
    } else {
      setTimeout(() => {
        if (bin.length >= 6) {
          Mercadopago.getPaymentMethod({
            'bin': bin
          }, (status, response) => {
            this.setPaymentMethodInfo(status, response);
          });
        }
      }, 100);
    }
  }
  /**
  * Establece la información del método de pago
  *
  * @see https://www.mercadopago.com.mx/developers/es/solutions/payments/custom-checkout/charge-with-credit-card-and-installments/javascript/
  *
  * @param status
  * @param response
  */
  setPaymentMethodInfo(status, response) {
    console.log(status);
    console.log(response);
    if (status === 200) {
      // do somethings ex: show logo of the payment method
      const form = document.querySelector('#pay');
      if (<HTMLInputElement>document.querySelector('input[name=paymentMethodId]') == null) {
        const paymentMethod = document.createElement('input');
        paymentMethod.setAttribute('name', 'paymentMethodId');
        paymentMethod.setAttribute('type', 'hidden');
        paymentMethod.setAttribute('value', response[0].id);
        form.appendChild(paymentMethod);
      } else {
        (<HTMLInputElement>document.querySelector('input[name=paymentMethodId]')).value = response[0].id;
      }
      // check if the security code (ex: Tarshop) is required
      const cardConfiguration = response[0].settings,
        bin = this.getBin(),
        amount = (<HTMLInputElement>document.querySelector('#amount')).value;
      for (let index = 0; index < cardConfiguration.length; index++) {
        if (bin.match(cardConfiguration[index].bin.pattern) != null && cardConfiguration[index].security_code.length === 0) {
          /*
          * In this case you do not need the Security code. You can hide the input.
          */
          this.showSecurityCode = false;
        } else {
          /*
          * In this case you NEED the Security code. You MUST show the input.
          */
          this.showSecurityCode = true;
        }
      }
      Mercadopago.getInstallments({
        'bin': bin,
        'amount': amount
      }, (newStatus, newResponse) => {
        this.setInstallmentInfo(newStatus, newResponse);
      });
      // check if the issuer is necessary to pay
      let issuerMandatory = false,
        additionalInfo = response[0].additional_info_needed;

      for (let i = 0; i < additionalInfo.length; i++) {
        if (additionalInfo[i] === 'issuer_id') {
          issuerMandatory = true;
        }
      }
      if (issuerMandatory) {
        this.showIssuer = true;
        Mercadopago.getIssuers(response[0].id, (newStatus, newResponse) => {
          this.showCardIssuers(newStatus, newResponse);
        });
        this.addEvent(document.querySelector('#issuer'), 'change', (newStatus, newResponse) => {
          this.setInstallmentsByIssuerId(newStatus, newResponse);
        });
      } else {
        this.showIssuer = false;
        (<HTMLSelectElement>document.querySelector('#issuer')).style.display = 'none';
        (<HTMLSelectElement>document.querySelector('#issuer')).options.length = 0;
      }
    }
  }

  showCardIssuers(status, issuers) {
    console.log(status);
    console.log('card issuers', issuers);
    const issuersSelector = <HTMLSelectElement>document.querySelector('#issuer'),
      fragment = document.createDocumentFragment();
    issuersSelector.options.length = 0;
    let option = new Option(this.translate.instant('MERCADOPAGO.CHOOSE'), '-1');
    fragment.appendChild(option);
    for (let i = 0; i < issuers.length; i++) {
      if (issuers[i].name !== 'default') {
        option = new Option(issuers[i].name, issuers[i].id);
      } else {
        option = new Option('Otro', issuers[i].id);
      }
      fragment.appendChild(option);
    }
    issuersSelector.appendChild(fragment);
    issuersSelector.removeAttribute('disabled');
    document.querySelector('#issuer').removeAttribute('style');
  }

  setInstallmentsByIssuerId(status, response) {
    const issuerId = (<HTMLInputElement>document.querySelector('#issuer')).value,
      amount = (<HTMLInputElement>document.querySelector('#amount')).value;
    if (issuerId === '-1') {
      return;
    }
    Mercadopago.getInstallments({
      'bin': this.getBin(),
      'amount': amount,
      'issuer_id': issuerId
    }, (newStatus, newResponse) => {
      this.setInstallmentInfo(newStatus, newResponse);
    });
  }

  setInstallmentInfo(status, response) {
    const selectorInstallments = <HTMLSelectElement>document.querySelector('#installments'),
      fragment = document.createDocumentFragment();
    selectorInstallments.options.length = 0;
    if (response.length > 0) {
      this.showInstallments = true;
      let option = new Option(this.translate.instant('MERCADOPAGO.CHOOSE'), '-1'),
        payerCosts = response[0].payer_costs;
      fragment.appendChild(option);
      for (let i = 0; i < payerCosts.length; i++) {
        option = new Option(payerCosts[i].recommended_message ||
          payerCosts[i].installments, payerCosts[i].installments);
        fragment.appendChild(option);
      }
      selectorInstallments.appendChild(fragment);
      selectorInstallments.removeAttribute('disabled');
    } else {
      this.showInstallments = false;
    }
  }

  cardsHandler() {
    this.clearOptions();
    const cardSelector = <any>document.querySelector('#cardId'),
      amount = (<HTMLInputElement>document.querySelector('#amount')).value;
    if (cardSelector && cardSelector[cardSelector.options.selectedIndex].value !== '-1') {
      const _bin = cardSelector[cardSelector.options.selectedIndex].getAttribute('first_six_digits');
      Mercadopago.getPaymentMethod({
        'bin': _bin
      }, (status, response) => {
        this.setPaymentMethodInfo(status, response);
      });
    }
  }
  /**
   * Evalúa el resultado del llamado del api de mercadopago para generar un token a
   * partir de los datos de la tarjeta.
   *
   * @see http://beta.mercadopago.com.mx/developers/es/guides/payments/api/receiving-payment-by-card
   * @see https://www.mercadopago.com.mx/developers/es/guides/payments/web-checkout/testing/
   *
   * @param event
   */
  async doPay(event) {
    event.preventDefault();
    if (!this.doSubmit) {
      // const loadingPay = await this.loadingCtrl.create({message: this.translate.instant('IS_PAYING')});
      // await loadingPay.present();
      const $form = document.querySelector('#pay');
      Mercadopago.createToken($form, async (status, response: MercadopagoResponse) => {
        if (status !== 200 && status !== 201) {
          switch (response.cause[0].code) {
            case '205': {
              this.presentToast(this.translate.instant('MERCADOPAGO.CARD.NUMBER_NULL'));
            }
            break;
            case '208': {
              this.presentToast(this.translate.instant('MERCADOPAGO.CARD.EXPIRATION_MONTH_NULL'));
            }
            break;
            case '209': {
              this.presentToast(this.translate.instant('MERCADOPAGO.CARD.EXPIRATION_YEAR_NULL'));
            }
            break;
            case '212': {
              this.presentToast(this.translate.instant('MERCADOPAGO.DOC.TYPE_NULL'));
            }
            break;
            case '213': {
              this.presentToast(this.translate.instant('MERCADOPAGO.DOC.SUBTYPE_NULL'));
            }
            break;
            case '214': {
              this.presentToast(this.translate.instant('MERCADOPAGO.DOC.NUMBER_NULL'));
            }
            break;
            case '220': {
              this.presentToast(this.translate.instant('MERCADOPAGO.CARD.CARD_ISSUER_ID_NULL'));
            }
            break;
            case '221': {
              this.presentToast(this.translate.instant('MERCADOPAGO.CARD.HOLDER_NAME_NULL'));
            }
            break;
            case '224': {
              this.presentToast(this.translate.instant('MERCADOPAGO.CARD.SECURITY_CODE_NULL'));
            }
            break;
            case 'E301': {
              this.presentToast(this.translate.instant('MERCADOPAGO.INVALID.CARD_NUMBER'));
            }
            break;
            case 'E302': {
              this.presentToast(this.translate.instant('MERCADOPAGO.INVALID.SECURITY_CODE'));
            }
            break;
            case '316': {
              this.presentToast(this.translate.instant('MERCADOPAGO.INVALID.HOLDER_NAME'));
            }
            break;
            case '322': {
              this.presentToast(this.translate.instant('MERCADOPAGO.INVALID.DOC_TYPE'));
            }
            break;
            case '323': {
              this.presentToast(this.translate.instant('MERCADOPAGO.INVALID.DOC_SUBTYPE'));
            }
            break;
            case '324':
              this.presentToast(this.translate.instant('MERCADOPAGO.INVALID.DOC_NUMBER'));
              break;
            case '325':
              this.presentToast(this.translate.instant('MERCADOPAGO.INVALID.EXPIRATION_MONTH'));
              break;
            case '326':
              this.presentToast(this.translate.instant('MERCADOPAGO.INVALID.EXPIRATION_YEAR'));
              break;
            default: {
              this.presentToast(this.translate.instant('MERCADOPAGO.ERROR'));
              break;
            }
          }
          // TODOawait loadingPay.dismiss();
        } else {
          const installments = (<HTMLSelectElement>document.querySelector('#installments')).value;
          response.installments = parseInt(installments, 36) || 1;
          console.log('paymentMethodId', (<HTMLSelectElement>document.querySelector('#paymentMethodId')).value);
          response.payment_method_id = (<HTMLSelectElement>document.querySelector('#paymentMethodId')).value;
          response.issuer_id = (<HTMLSelectElement>document.querySelector('#issuer')).value;
          response.email = (<HTMLInputElement>document.querySelector('#email')).value;
          console.log(response);
          this.api.post('/user/pay', response).then(async (result) => {
            console.log(result);
            // TODO: await loadingPay.dismiss();
            this.dismiss('FORM.SUCCESS');
          }, async (fail) => {
            // TODO: await loadingPay.dismiss();
            console.log('[modal-mercadopago-187]', fail);
          });
        }
      });
      return false;
    }
  }

  /**
   * Cierra la vista.
   * @param {any} message Mensaje en caso de realizar una acción al cerrar el modal.
   */
  dismiss(message?: any): void {
    this.modalCtrl.dismiss(message);
  }

  /**
   * Presenta un cuadro de mensaje.
   * @param {string} text Mensaje a mostrar.
   */
  async presentToast(text: string) {
    const toast = await this.toastCtrl.create({
      message: text,
      duration: 3000,
      position: 'top'
    });
    await toast.present();
  }
}
