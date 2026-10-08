import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App, RouterTestingModule],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renderiza el toggler compacto sin mostrar el menu hasta abrirlo', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.topbar')).toBeTruthy();
    expect(compiled.querySelector('.menu-toggle')).toBeTruthy();
    expect(compiled.querySelector('.menu-panel')).toBeNull();
  });

  it('despliega el menu con las 4 pantallas al pulsar el toggler', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const toggle = compiled.querySelector('.menu-toggle') as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();
    const panel = compiled.querySelector('.menu-panel');
    expect(panel).toBeTruthy();
    expect(panel?.textContent).toContain('Ficha');
    expect(panel?.textContent).toContain('Master');
    expect(panel?.textContent).toContain('Combat');
    expect(panel?.textContent).toContain('Sim');
  });
});
