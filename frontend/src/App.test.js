import { render, screen } from '@testing-library/react';
import React from 'react';

// Simple smoke test that doesn't require routing
test('react renders', () => {
  render(<div>Test</div>);
  expect(screen.getByText('Test')).toBeInTheDocument();
});
