import type {Properties} from 'csstype'; // eslint-disable-line
import {ThemeOptions} from '@material-ui/core/styles';
import React from 'react';
import { Props as StoreProps } from '../Store/Store.types';

export interface utTheme extends ThemeOptions {
    ut?: {
        classes?: {},
        headerLogo?: Properties,
        loginTop?: Properties,
        loginBottom?: Properties
    },
    name?: string
}

export interface Props extends StoreProps, React.HTMLAttributes<HTMLDivElement> {
    theme: utTheme,
    portalName: string,
    loginPage?: string
}

export type StyledType = React.FC<Props>
