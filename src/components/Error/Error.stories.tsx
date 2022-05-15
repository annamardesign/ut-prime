import React from 'react';
import type { Meta } from '@storybook/react';

// @ts-ignore: md file and not a module
import page from './README.mdx';
import Error from './index';

const meta: Meta = {
    title: 'Error',
    component: Error,
    parameters: {docs: {page}},
    args: {
        state: {
            error: {
                open: true
            }
        }
    }
};
export default meta;

export const Basic = () => <Error message='Error message' />;
export const InvalidCredentials = () => <Error />;
export const InterpolateProps = () => <Error message='Error {message}' params={{message: 'message'}} />;
export const InterpolateRedux = () => <Error />;

InvalidCredentials.args = {
    state: {
        error: {
            open: true,
            message: 'Invalid credentials',
            type: 'identity.invalidCredentials'
        }
    }
};

InterpolateRedux.args = {
    state: {
        error: {
            open: true,
            message: 'Error {message}',
            type: 'core.throttle',
            params: {
                message: 'dynamic'
            },
            title: 'Error'
        }
    }
};
