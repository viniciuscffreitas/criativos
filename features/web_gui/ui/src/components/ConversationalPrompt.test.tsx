import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConversationalPrompt } from './ConversationalPrompt';

describe('ConversationalPrompt', () => {
  it('renders an empty textarea + Send button', () => {
    render(<ConversationalPrompt onSubmit={() => {}} busy={false}/>);
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByRole('button', { name: /enviar/i })).toBeInTheDocument();
  });

  it('Send is disabled when prompt is empty', () => {
    render(<ConversationalPrompt onSubmit={() => {}} busy={false}/>);
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
  });

  it('Send is disabled when busy even with text', () => {
    render(<ConversationalPrompt onSubmit={() => {}} busy={true}/>);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x' } });
    expect(screen.getByRole('button', { name: /trabalhando/i })).toBeDisabled();
  });

  it('clicking Send calls onSubmit with the trimmed prompt', () => {
    const onSubmit = vi.fn();
    render(<ConversationalPrompt onSubmit={onSubmit} busy={false}/>);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '  preciso de um post sobre lançamento  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    expect(onSubmit).toHaveBeenCalledWith('preciso de um post sobre lançamento');
  });

  it('Cmd+Enter submits', () => {
    const onSubmit = vi.fn();
    render(<ConversationalPrompt onSubmit={onSubmit} busy={false}/>);
    const ta = screen.getByRole('textbox');
    fireEvent.change(ta, { target: { value: 'hello' } });
    fireEvent.keyDown(ta, { key: 'Enter', metaKey: true });
    expect(onSubmit).toHaveBeenCalledWith('hello');
  });

  it('Ctrl+Enter submits', () => {
    const onSubmit = vi.fn();
    render(<ConversationalPrompt onSubmit={onSubmit} busy={false}/>);
    const ta = screen.getByRole('textbox');
    fireEvent.change(ta, { target: { value: 'hello' } });
    fireEvent.keyDown(ta, { key: 'Enter', ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledWith('hello');
  });

  it('plain Enter does NOT submit (lets newline through)', () => {
    const onSubmit = vi.fn();
    render(<ConversationalPrompt onSubmit={onSubmit} busy={false}/>);
    const ta = screen.getByRole('textbox');
    fireEvent.change(ta, { target: { value: 'hello' } });
    fireEvent.keyDown(ta, { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not call onSubmit when prompt is whitespace-only', () => {
    const onSubmit = vi.fn();
    render(<ConversationalPrompt onSubmit={onSubmit} busy={false}/>);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
