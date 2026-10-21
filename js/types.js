import { TYPES } from './parser.js';

export { TYPES };

export const typeLabel = (id) => TYPES.find((t) => t.id === id)?.label ?? '기타';
