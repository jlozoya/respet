/**
 * Plantillas de los correos que envía la aplicación.
 *
 * Se escriben como funciones de TypeScript en lugar de archivos Handlebars:
 * el compilador comprueba que no falte ninguna variable, no hay que copiar
 * plantillas al `dist` al empaquetar y el juego de idiomas queda explícito.
 */

export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
}

export type Lang = 'es' | 'en';

export function resolveLang(lang: string | null | undefined): Lang {
  return lang?.toLowerCase().startsWith('en') ? 'en' : 'es';
}

/** Escapa el texto que se interpola dentro del HTML del correo. */
function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(options: { title: string; body: string; action?: { label: string; url: string } }): string {
  const button = options.action
    ? `<p style="margin:32px 0;text-align:center">
         <a href="${options.action.url}"
            style="background:#ff6b35;border-radius:8px;color:#ffffff;display:inline-block;
                   font-weight:600;padding:14px 28px;text-decoration:none">
           ${escape(options.action.label)}
         </a>
       </p>
       <p style="color:#6b7280;font-size:13px;line-height:1.6">
         ${escape(options.action.label)}:<br>
         <a href="${options.action.url}" style="color:#ff6b35;word-break:break-all">${options.action.url}</a>
       </p>`
    : '';

  return `<!doctype html>
<html>
  <body style="background:#f5f5f4;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;margin:0;padding:24px">
    <table role="presentation" style="background:#ffffff;border-radius:12px;margin:0 auto;max-width:560px;padding:32px">
      <tr><td>
        <h1 style="color:#1f2937;font-size:22px;margin:0 0 16px">${escape(options.title)}</h1>
        <div style="color:#374151;font-size:15px;line-height:1.7">${options.body}</div>
        ${button}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px">
        <p style="color:#9ca3af;font-size:12px;margin:0">Respet</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function verifyEmailMail(params: { name: string; url: string; lang: Lang }): RenderedMail {
  const { name, url, lang } = params;

  if (lang === 'en') {
    return {
      subject: 'Confirm your email address',
      html: layout({
        title: `Welcome, ${escape(name)}`,
        body: '<p>Confirm this address to finish setting up your Respet account.</p><p>The link is valid for 24 hours.</p>',
        action: { label: 'Confirm email', url },
      }),
      text: `Welcome, ${name}. Confirm your email address: ${url} (valid for 24 hours).`,
    };
  }

  return {
    subject: 'Confirma tu correo electrónico',
    html: layout({
      title: `Te damos la bienvenida, ${escape(name)}`,
      body: '<p>Confirma esta dirección para terminar de activar tu cuenta de Respet.</p><p>El enlace caduca en 24 horas.</p>',
      action: { label: 'Confirmar correo', url },
    }),
    text: `Te damos la bienvenida, ${name}. Confirma tu correo: ${url} (caduca en 24 horas).`,
  };
}

export function resetPasswordMail(params: { name: string; url: string; lang: Lang }): RenderedMail {
  const { name, url, lang } = params;

  if (lang === 'en') {
    return {
      subject: 'Reset your password',
      html: layout({
        title: 'Reset your password',
        body: `<p>Hi ${escape(name)}, we received a request to reset your password.</p>
               <p>The link is valid for one hour. If it wasn't you, ignore this message: your password stays unchanged.</p>`,
        action: { label: 'Choose a new password', url },
      }),
      text: `Hi ${name}. Reset your password here: ${url} (valid for one hour). If it wasn't you, ignore this message.`,
    };
  }

  return {
    subject: 'Restablece tu contraseña',
    html: layout({
      title: 'Restablece tu contraseña',
      body: `<p>Hola ${escape(name)}, hemos recibido una solicitud para cambiar tu contraseña.</p>
             <p>El enlace caduca en una hora. Si no has sido tú, ignora este mensaje: tu contraseña seguirá igual.</p>`,
      action: { label: 'Elegir una contraseña nueva', url },
    }),
    text: `Hola ${name}. Restablece tu contraseña aquí: ${url} (caduca en una hora). Si no has sido tú, ignora este mensaje.`,
  };
}

export function supportConfirmationMail(params: { name: string; lang: Lang }): RenderedMail {
  const { name, lang } = params;

  if (lang === 'en') {
    return {
      subject: 'We received your message',
      html: layout({
        title: 'Thanks for writing to us',
        body: `<p>Hi ${escape(name)}, your message reached us and we will reply as soon as we can.</p>`,
      }),
      text: `Hi ${name}, your message reached us and we will reply as soon as we can.`,
    };
  }

  return {
    subject: 'Hemos recibido tu mensaje',
    html: layout({
      title: 'Gracias por escribirnos',
      body: `<p>Hola ${escape(name)}, tu mensaje nos ha llegado y te responderemos lo antes posible.</p>`,
    }),
    text: `Hola ${name}, tu mensaje nos ha llegado y te responderemos lo antes posible.`,
  };
}

export function supportNotificationMail(params: {
  name: string;
  email: string;
  phone: string | null;
  message: string;
}): RenderedMail {
  const { name, email, phone, message } = params;

  return {
    subject: `Nuevo mensaje de contacto de ${name}`,
    html: layout({
      title: 'Nuevo mensaje de contacto',
      body: `<p><strong>Nombre:</strong> ${escape(name)}<br>
             <strong>Correo:</strong> ${escape(email)}<br>
             <strong>Teléfono:</strong> ${escape(phone ?? '—')}</p>
             <p style="background:#f9fafb;border-left:3px solid #ff6b35;padding:12px 16px;white-space:pre-wrap">${escape(message)}</p>`,
    }),
    text: `Nuevo mensaje de ${name} <${email}> (tel. ${phone ?? '—'}):\n\n${message}`,
  };
}

export function paymentConfirmationMail(params: {
  name: string;
  orderId: string;
  total: string;
  lang: Lang;
}): RenderedMail {
  const { name, orderId, total, lang } = params;

  if (lang === 'en') {
    return {
      subject: `Payment confirmed for order #${orderId}`,
      html: layout({
        title: 'Payment confirmed',
        body: `<p>Hi ${escape(name)}, we received your payment of <strong>${escape(total)}</strong> for order #${orderId}.</p>
               <p>We will let you know as soon as it ships.</p>`,
      }),
      text: `Hi ${name}, we received your payment of ${total} for order #${orderId}.`,
    };
  }

  return {
    subject: `Pago confirmado del pedido n.º ${orderId}`,
    html: layout({
      title: 'Pago confirmado',
      body: `<p>Hola ${escape(name)}, hemos recibido tu pago de <strong>${escape(total)}</strong> por el pedido n.º ${orderId}.</p>
             <p>Te avisaremos en cuanto salga para su entrega.</p>`,
    }),
    text: `Hola ${name}, hemos recibido tu pago de ${total} por el pedido n.º ${orderId}.`,
  };
}

/** De qué avisa un correo de seguridad. */
export type SecurityAlertKind =
  | 'new_login'
  | 'password_changed'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'session_hijack'
  | 'app_authorized';

const SECURITY_COPY: Record<Lang, Record<SecurityAlertKind, { subject: string; body: string }>> = {
  es: {
    new_login: {
      subject: 'Nuevo inicio de sesión en tu cuenta',
      body: 'Alguien ha entrado en tu cuenta de Respet desde un dispositivo que no habíamos visto antes.',
    },
    password_changed: {
      subject: 'Tu contraseña ha cambiado',
      body: 'La contraseña de tu cuenta de Respet se acaba de cambiar y se han cerrado las demás sesiones.',
    },
    mfa_enabled: {
      subject: 'Verificación en dos pasos activada',
      body: 'Has activado la verificación en dos pasos. A partir de ahora te pediremos un código al iniciar sesión.',
    },
    mfa_disabled: {
      subject: 'Verificación en dos pasos desactivada',
      body: 'Se ha desactivado la verificación en dos pasos de tu cuenta de Respet.',
    },
    session_hijack: {
      subject: 'Hemos cerrado una sesión sospechosa',
      body: 'Detectamos que una sesión de tu cuenta se estaba usando desde dos sitios a la vez y la hemos cerrado por seguridad.',
    },
    app_authorized: {
      subject: 'Has conectado una aplicación a tu cuenta',
      body: 'Una aplicación de terceros tiene ahora acceso a tu cuenta de Respet con los permisos que aprobaste.',
    },
  },
  en: {
    new_login: {
      subject: 'New sign-in to your account',
      body: 'Someone signed in to your Respet account from a device we had not seen before.',
    },
    password_changed: {
      subject: 'Your password was changed',
      body: 'The password of your Respet account was just changed and your other sessions were signed out.',
    },
    mfa_enabled: {
      subject: 'Two-step verification turned on',
      body: 'You turned on two-step verification. From now on we will ask for a code when you sign in.',
    },
    mfa_disabled: {
      subject: 'Two-step verification turned off',
      body: 'Two-step verification was turned off for your Respet account.',
    },
    session_hijack: {
      subject: 'We closed a suspicious session',
      body: 'A session of your account was being used from two places at once, so we signed it out for your safety.',
    },
    app_authorized: {
      subject: 'You connected an app to your account',
      body: 'A third-party app now has access to your Respet account with the permissions you approved.',
    },
  },
};

export function securityAlertMail(params: {
  name: string;
  kind: SecurityAlertKind;
  lang: Lang;
  /** Líneas de detalle: el dispositivo, la IP, la aplicación. */
  details: string[];
  url: string;
}): RenderedMail {
  const copy = SECURITY_COPY[params.lang][params.kind];
  const greeting = params.lang === 'en' ? `Hi ${params.name},` : `Hola ${params.name}:`;
  const notYou =
    params.lang === 'en'
      ? "If it wasn't you, change your password and review your active sessions right away."
      : 'Si no has sido tú, cambia tu contraseña y revisa tus sesiones abiertas cuanto antes.';
  const label = params.lang === 'en' ? 'Review security' : 'Revisar la seguridad';
  const details = params.details.map((line) => `<li>${escape(line)}</li>`).join('');

  return {
    subject: copy.subject,
    html: layout({
      title: copy.subject,
      body: `<p>${escape(greeting)}</p><p>${escape(copy.body)}</p>
             ${details ? `<ul style="color:#6b7280;font-size:14px">${details}</ul>` : ''}
             <p>${escape(notYou)}</p>`,
      action: { label, url: params.url },
    }),
    text: [greeting, copy.body, ...params.details, notYou, params.url].join('\n'),
  };
}
