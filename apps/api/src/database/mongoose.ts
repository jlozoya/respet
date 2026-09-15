import mongoose from 'mongoose';

/**
 * Puerta de entrada a Mongoose desde código ESM.
 *
 * Mongoose se publica como CommonJS, y Node no consigue deducir sus nombres al
 * importarlo desde un módulo ESM: `import { Connection } from 'mongoose'`
 * compila pero revienta al arrancar con «does not provide an export named». Lo
 * que sí funciona es el objeto por defecto, así que los valores se sacan de
 * ahí una sola vez y el resto del proyecto los importa de aquí.
 *
 * Los tipos se reexportan tal cual: al desaparecer en la compilación, nunca
 * llegan a pedirle nada a Node.
 */
export const { isValidObjectId, SchemaTypes, MongooseError } = mongoose;

/** El constructor de identificadores, para `new ObjectId(...)`. */
export const ObjectId = mongoose.Types.ObjectId;

export type {
  ClientSession,
  Connection,
  HydratedDocument,
  Model,
  Types,
} from 'mongoose';
