import Joi from 'joi';
import { Schema, Property } from '../types';
import getType from '../lib/getType';

function numeric(field: Schema) {
    let result = Joi.number();
    if (field.maximum) result = result.max(field.maximum);
    if (field.exclusiveMaximum) result = result.less(field.exclusiveMaximum);
    if (field.minimum) result = result.min(field.minimum);
    if (field.exclusiveMinimum) result = result.greater(field.exclusiveMinimum);
    if (field.multipleOf) result = result.multiple(field.multipleOf);
    return result;
}

function string(field: Schema) {
    let result = Joi.string();
    if (field.minLength) result = result.min(field.minLength);
    if (field.maxLength) result = result.max(field.maxLength);
    if (field.pattern) result = result.pattern(new RegExp(field.pattern));
    return result;
}

function array(field: Schema, filter?: string[], path?: string, propertyName?: string) {
    let result = Joi.array();
    if (field.minItems) result = result.min(field.minItems);
    if (field.maxItems) result = result.max(field.maxItems);
    if (field.uniqueItems) result = result.unique();
    if (field.contains) result.has(getValidation(field.contains as Schema, filter, path, propertyName)[0]);
    return result;
}

function object(field: Schema, keys: object) {
    let result = Joi.object(keys);
    if (field.maxProperties) result = result.max(field.maxProperties);
    if (field.minProperties) result = result.min(field.minProperties);
    return result;
}

function validation(name, field) {
    let result = field.validation;
    if (!result) {
        switch (field?.widget?.type || field.format || getType(field.type) || 'unknown') {
            case 'mask':
            case 'text':
            case 'password':
            case 'string':
                result = string(field);
                break;
            case 'unknown':
                result = Joi.alternatives().try(Joi.string(), Joi.number());
                break;
            case 'currency':
            case 'number':
                result = numeric(field);
                break;
            case 'integer':
                result = numeric(field).integer();
                break;
            case 'boolean':
                result = Joi.boolean();
                break;
            case 'selectTable':
                result = field?.widget?.selectionMode === 'single' ? Joi.any() : array(field);
                break;
            case 'multiSelect':
            case 'multiSelectPanel':
            case 'multiSelectTree':
                result = array(field);
                break;
            case 'table':
            case 'array':
                result = array(field).sparse();
                break;
            case 'date-time':
            case 'time':
            case 'date':
                result = Joi.date();
                break;
            case 'file':
                result = Joi.any().raw();
                break;
            case 'dropdown':
            case 'dropdownTree':
            case 'select':
            default:
                result = Joi.any();
                break;
        }
        if (field.enum) result = result.valid(...field.enum);
        if (field.const) result = result.valid(field.const);
    }
    return (field.title || name) ? result.label(field.title || name) : result;
}

export default function getValidation(schema: Schema | Property, filter?: string[], path = '', propertyName = '') : [Joi.Schema, string[]] {
    if (schema?.type === 'object' || schema?.properties) {
        return Object.entries(schema?.properties || {}).reduce(
            ([prevSchema, prevRequired], [name, field]) => {
                const [nextSchema, required] = getValidation(field, filter, path ? path + '.' + name : name, name);
                if (!nextSchema) return [prevSchema, prevRequired];
                return [
                    prevSchema.append({
                        [name]: schema?.required?.includes(name)
                            ? nextSchema.empty([null, '']).required()
                            : nextSchema.allow(null)
                    }),
                    [...prevRequired, ...required]
                ];
            },
            [
                object(
                    schema,
                    path
                        ? undefined
                        : {
                            $: Joi.any().strip(),
                            $key: Joi.any().strip(),
                            ...(filter?.includes('$original') && { $original: Joi.any() })
                        }
                ),
                [].concat(schema?.required?.map?.((r) => [path, r].filter(Boolean).join('.'))).filter(Boolean)
            ]
        );
    }
    if (filter && !filter?.includes(path)) return [null, []];
    if (schema?.type === 'array' || schema?.items) {
        const [validation, required] = schema?.items ? getValidation(schema.items as Schema, filter, path, propertyName) : [null, []];
        return [schema?.items ? array(schema, filter, path, propertyName).sparse().items(validation) : array(schema, filter, path, propertyName), required];
    } else if (schema?.oneOf) {
        return [Joi.alternatives().try(...schema.oneOf.map(item => getValidation(item as Schema, filter, path, propertyName)[0]).filter(Boolean)).match('one'), []];
    } else if (schema?.anyOf) {
        return [Joi.alternatives().try(...schema.anyOf.map(item => getValidation(item as Schema, filter, path, propertyName)[0]).filter(Boolean)).match('any'), []];
    } else if (schema?.allOf) {
        return [Joi.alternatives().try(...schema.allOf.map(item => getValidation(item as Schema, filter, path, propertyName)[0]).filter(Boolean)).match('all'), []];
    } else {
        return [validation(propertyName, schema), []];
    }
}
