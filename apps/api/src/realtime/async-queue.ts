/**
 * Un iterador asíncrono alimentado desde fuera.
 *
 * Es lo que espera GraphQL de una suscripción: algo que se recorre con
 * `for await` y que se puede cerrar. Los eventos llegan por `push` cuando los
 * publica quien sea; si nadie los está leyendo en ese momento se encolan, y si
 * alguien espera se le entregan en el acto.
 *
 * La cola tiene tope. Un cliente con la conexión atascada no debe acumular
 * eventos sin límite en la memoria del servidor: pasado el tope se descartan
 * los más antiguos, que es lo que menos daño hace —un aviso viejo de
 * «escribiendo…» no le sirve a nadie— y el cliente se pone al día al
 * reconectar pidiendo el estado por consulta.
 */
export function createAsyncQueue<T>(
  onClose: () => void,
  maxBuffered = 500,
): AsyncIterableIterator<T> & { push(value: T): void } {
  const buffered: T[] = [];
  const waiting: ((result: IteratorResult<T>) => void)[] = [];
  let closed = false;

  const close = (): void => {
    if (closed) {
      return;
    }

    closed = true;
    buffered.length = 0;

    for (const resolve of waiting.splice(0)) {
      resolve({ value: undefined, done: true });
    }

    onClose();
  };

  return {
    push(value: T): void {
      if (closed) {
        return;
      }

      const next = waiting.shift();

      if (next) {
        next({ value, done: false });

        return;
      }

      buffered.push(value);

      if (buffered.length > maxBuffered) {
        buffered.shift();
      }
    },

    next(): Promise<IteratorResult<T>> {
      if (buffered.length > 0) {
        return Promise.resolve({ value: buffered.shift() as T, done: false });
      }

      if (closed) {
        return Promise.resolve({ value: undefined, done: true });
      }

      return new Promise((resolve) => waiting.push(resolve));
    },

    return(): Promise<IteratorResult<T>> {
      close();

      return Promise.resolve({ value: undefined, done: true });
    },

    throw(error?: unknown): Promise<IteratorResult<T>> {
      close();

      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    },

    [Symbol.asyncIterator]() {
      return this;
    },
  };
}
