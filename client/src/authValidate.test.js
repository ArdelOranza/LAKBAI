import { describe, it, expect } from 'vitest';
import { validateSignup, validateLogin } from './authValidate.js';
describe('validateSignup', () => {
  it('rejects bad email, short password, mismatched confirm', () => {
    expect(validateSignup({ email:'nope', password:'12345678', confirm:'12345678' })).toEqual({ ok:false, field:'email', message:'Enter a valid email address.' });
    expect(validateSignup({ email:'a@b.com', password:'123', confirm:'123' })).toEqual({ ok:false, field:'password', message:'Password must be at least 8 characters.' });
    expect(validateSignup({ email:'a@b.com', password:'12345678', confirm:'12345679' })).toEqual({ ok:false, field:'confirm', message:'Passwords do not match.' });
  });
  it('accepts a clean form', () => {
    expect(validateSignup({ email:'a@b.com', password:'onetwothree', confirm:'onetwothree' })).toEqual({ ok:true });
  });
});
describe('validateLogin', () => {
  it('needs email + non-empty password', () => {
    expect(validateLogin({ email:'', password:'x' }).ok).toBe(false);
    expect(validateLogin({ email:'a@b.com', password:'' }).ok).toBe(false);
    expect(validateLogin({ email:'a@b.com', password:'x' }).ok).toBe(true);
  });
});
