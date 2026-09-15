// Otorgue al service worker acceso a la Mensajería de Firebase.
// Tenga en cuenta que solo puede usar Firebase Messaging aquí, otras bibliotecas de Firebase
// no están disponibles en el trabajador de servicio.
importScripts('./firebase-app.js');
importScripts('./firebase-messaging.js');

// Inicializa la aplicación de Firebase en el trabajador de servicio pasando el
// messagingSenderId.
firebase.initializeApp({
  'messagingSenderId': '220558166944'
});

// Recuperar una instancia de Firebase Messaging para que pueda manejar el fondo
// mensajes.
const messaging = firebase.messaging();
