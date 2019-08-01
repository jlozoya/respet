import { TranslateService } from '@ngx-translate/core';
import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import { Platform } from '@ionic/angular';
import { ApiService, Analytics, AnalyticsUsersRegistration } from '../../../providers/providers';
import { Chart } from 'chart.js';

@Component({
  selector: 'app-analytics',
  templateUrl: 'analytics.page.html',
  styleUrls: ['analytics.page.scss']
})
export class AnalyticsPage implements OnInit {

  analytics: Analytics;
  doughnutUsersChartConfig;
  @ViewChild('doughnutUsersChart', {static: false}) doughnutUsersChart: ElementRef;
  interval: 'lastWeek' | 'lastMonth' | 'lastYear' = 'lastMonth';
  lineUsersChartConfig;
  @ViewChild('lineUsersChart', {static: false}) lineUsersChart: ElementRef;

  constructor(
    public platform: Platform,
    private translate: TranslateService,
    private api: ApiService
  ) {
    this.analytics = {
      users_number: 0,
      gender: {
        male_number: 0,
        female_number: 0,
      },
      support_number: 0,
      ages: {
        children: 0,
        teens: 0,
        young_adults: 0,
        unknown: 0
      },
      grant_types: {
        password: 0,
        facebook: 0,
        google: 0,
      }
    };
  }
  ngOnInit() {
    this.platform.ready().then(() => {
      this.generateDoughnutCharts();
      this.generateLineCharts();
    });
  }
  /**
   * Establece la estructura de las graficas de dona.
   */
  generateDoughnutCharts() {
    Chart.pluginService.register({
      beforeDraw: (chart) => {
        if (chart.config.options.elements.center) {
          // Obtiene la cadena de ctx
          const ctx = chart.chart.ctx;
          // Obtiene ctx de la cadena
          // Obtiene opciones del objeto central en las opciones
          const centerConfig = chart.config.options.elements.center;
          const fontStyle = centerConfig.fontStyle || 'Arial';
          const txt = centerConfig.text || '';
          const color = centerConfig.color || '#000';
          const sidePadding = centerConfig.sidePadding || 20;
          const sidePaddingCalculated = (sidePadding / 100) * (chart.innerRadius * 2);
          // Comience con una fuente base de 30px.
          ctx.font = `${centerConfig.fontSize || 30}px ${fontStyle}`;
          // Obtiene el ancho de la cadena y también el ancho del elemento menos 10 para darle un relleno lateral de 5 píxeles.
          const stringWidth = ctx.measureText(txt).width;
          const elementWidth = (chart.innerRadius * 2) - sidePaddingCalculated;
          // Averigua cuánto puede aumentar la anchura de la fuente.
          const widthRatio = elementWidth / stringWidth;
          const newFontSize = Math.floor(30 * widthRatio);
          const elementHeight = (chart.innerRadius * 2);
          // Elije un nuevo tamaño de fuente para que no sea más grande que el alto de la etiqueta.
          const fontSizeToUse = Math.min(newFontSize, elementHeight);
          // Configure la fuente para dibujarla correctamente.
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const centerX = ((chart.chartArea.left + chart.chartArea.right) / 2);
          const centerY = ((chart.chartArea.top + chart.chartArea.bottom) / 2);
          if (fontSizeToUse < centerConfig.fontSize) { ctx.font = `${fontSizeToUse}px ${fontStyle}`; }
          ctx.fillStyle = color;
          // Dibuja el texto en el centro
          ctx.fillText(txt, centerX, centerY);
          if (centerConfig.textTitle) {
            // Establece la configuración para un encabezado en la grafica.
            // Obtiene opciones del objeto central en opciones
            const centerConfigTitle = chart.config.options.elements.center;
            const fontStyleTitle = centerConfigTitle.fontStyleTitle || 'Arial';
            const txtTitle = centerConfigTitle.textTitle || '';
            const colorTitle = centerConfigTitle.colorTitle || '#000';
            const sidePaddingTitle = centerConfigTitle.sidePaddingTitle || 20;
            // Comiensa con una fuente base de 30 px
            ctx.font = `${centerConfigTitle.fontSizeTitle || 30}px ${fontStyleTitle}`;
            let currentHeight = centerConfig.fontSize || 30;
            if (fontSizeToUse < centerConfig.fontSize) { currentHeight = fontSizeToUse; }
            const newFontSizeTitle = (sidePaddingTitle / 100) * (Math.sqrt(Math.pow(chart.innerRadius, 2) - Math.pow(currentHeight, 2)) * 2);
            const elementHeightTitle = (chart.innerRadius * 2);
            // Elije un nuevo tamaño de fuente para que no sea más grande que el alto de la etiqueta.
            const fontSizeToUseTitle = Math.min(newFontSizeTitle, elementHeightTitle);
            // Configura la fuente para dibujarla correctamente.
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const centerXTitle = ((chart.chartArea.left + chart.chartArea.right) / 2);
            let centerYTitleExtra = centerConfig.fontSize || 30;
            if (fontSizeToUse < centerConfig.fontSize) {
              centerYTitleExtra = fontSizeToUse;
            }
            const centerYTitle = (((chart.chartArea.top + chart.chartArea.bottom) / 2) - centerYTitleExtra);
            if (fontSizeToUseTitle < centerConfig.fontSizeTitle) {
              ctx.font = `${fontSizeToUseTitle}px ${fontStyleTitle}`;
            }
            ctx.fillStyle = colorTitle;
            // Dibuja texto en el centro
            ctx.fillText(txtTitle, centerXTitle, centerYTitle);
          }
        }
      }
    });
    const ctxs = this.doughnutUsersChart.nativeElement;
    this.doughnutUsersChartConfig = new Chart(ctxs, {
      type: 'doughnut',
      data: {
        datasets: [],
      },
      labels: [
        this.translate.instant('MALES'),
        this.translate.instant('FEMALES'),
        this.translate.instant('UNKNOWNS'),
        this.translate.instant('CHILDREN'),
        this.translate.instant('TEENS'),
        this.translate.instant('YOUNG_ADULTS'),
        this.translate.instant('ADULTS'),
        this.translate.instant('UNKNOWNS'),
        'App', 'Facebook', 'Google'
      ],
      options: {
        cutoutPercentage: 85,
        legend: {
          display: false
        },
        elements: {
          center: {
            text: '0',
            color: '#263238',
            fontStyle: 'Eczar',
            textTitle: this.translate.instant('USERS'),
            fontSizeTitle: 15,
            colorTitle: '#263238',
            fontStyleTitle: 'Roboto Condensed',
            sidePaddingTitle: 15
          }
        },
        tooltips: {
          callbacks: {
            label: (tooltipItem, data) => {
              const label = data.datasets[tooltipItem.datasetIndex].labels[tooltipItem.index];
              const value = data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
              return `${label}: ${value}`;
            }
          }
        }
      }
    });
    this.getDoughnutData();
  }
  /**
   * Recupera la información básica del servidor para las graficas de dona.
   */
  getDoughnutData() {
    return new Promise(result => {
      this.api.get('/analytics').then((analytics: Analytics) => {
        this.analytics = analytics;
        this.doughnutUsersChartConfig.options.elements.center.text = analytics.users_number;
        this.doughnutUsersChartConfig.data.datasets = [{
          labels: [
            this.translate.instant('MALES'),
            this.translate.instant('FEMALES'),
            this.translate.instant('UNKNOWNS'),
          ],
          data: [analytics.gender.male_number, analytics.gender.female_number,
            ((analytics.users_number) - analytics.gender.male_number - analytics.gender.female_number)
          ],
          backgroundColor: ['#045d56', '#1eb980', '#37efba'],
          borderColor: ['#3f3f49', '#3f3f49', '#3f3f49'],
          borderWidth: [1, 1, 1]
        },
        {
          labels: [
            this.translate.instant('CHILDREN'),
            this.translate.instant('TEENS'),
            this.translate.instant('YOUNG_ADULTS'),
            this.translate.instant('ADULTS'),
            this.translate.instant('UNKNOWNS')
          ],
          data: [analytics.ages.children, analytics.ages.teens, analytics.ages.young_adults,
            analytics.users_number - (analytics.ages.children + analytics.ages.teens + analytics.ages.young_adults + analytics.ages.unknown),
            analytics.ages.unknown
          ],
          backgroundColor: ['#ff6859', '#ff857c', '#ffdc78', '#ffac12', '#ffd7d0'],
          borderColor: ['#3f3f49', '#3f3f49', '#3f3f49', '#3f3f49', '#3f3f49'],
          borderWidth: [1, 1, 1, 1, 1]
        },
        {
          labels: [
            'Password', 'Facebook', 'Google'
          ],
          data: [analytics.grant_types.password, analytics.grant_types.facebook, analytics.grant_types.google],
          backgroundColor: ['#f1c40f', '#3b5998', '#dc4a38'],
          borderColor: ['#3f3f49', '#3f3f49', '#3f3f49'],
          borderWidth: [1, 1, 1]
        }];
        this.doughnutUsersChartConfig.update();
        result(true);
      }, fail => {
        console.log('[analytics-32]', fail);
        result(false);
      });
    });
  }
  /**
   * Establece las gráficas de líneas.
   */
  generateLineCharts() {
    const ctx = this.lineUsersChart.nativeElement;
    this.lineUsersChartConfig = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: this.translate.instant('USERS'),
          borderColor: '#fa8072',
          // backgroundColor: '#fb8d80',
          data: [],
        }],
        labels: [],
      },
      options: {
        scales: {
          yAxes: [{
            ticks: {
              fontColor: '#f4f4f4',
              fontSize: 14,
              stepSize: true,
            }
          }],
          xAxes: [{
            ticks: {
              fontColor: '#f4f4f4',
              fontSize: 14
            }
          }]
        }
      }
    });
    this.getLineData();
  }
  /**
   * Recupera la información básica del servidor para las graficas de lineas.
   */
  getLineData() {
    return new Promise((result) => {
      this.api.get(`/analytics/users/registration?interval=${this.interval}`).then((response: AnalyticsUsersRegistration[]) => {
        this.lineUsersChartConfig.data.labels = [];
        this.lineUsersChartConfig.data.datasets[0].data = [];
        response.forEach((dates) => {
          this.lineUsersChartConfig.data.labels.push(dates.created_at);
          this.lineUsersChartConfig.data.datasets[0].data.push(dates.users);
          this.lineUsersChartConfig.update();
        });
        result(true);
      }, fail => {
        console.log('[analytics-248]', fail);
        result(false);
      });
    });
  }
  /**
   * Refresca la página.
   * @param event
   */
  doRefresh(event) {
    this.getDoughnutData().then(() => {
      this.getLineData().then(() => {
        event.target.complete();
      });
    });
  }
}

