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
