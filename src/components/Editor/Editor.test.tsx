import React from 'react';

import { render } from '../test';
import { Basic } from './Editor.stories';

describe('<Editor />', () => {
    it('render equals snapshot', () => {
        const { getByTestId } = render(<Basic />);
        expect(getByTestId('ut-front-test')).toMatchSnapshot();
    });
});
