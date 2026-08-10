import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('TokTickIT app smoke test', () => {
  it('renders the main heading', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /TokTickIT IT Service Desk/i })).toBeTruthy();
  });
});
