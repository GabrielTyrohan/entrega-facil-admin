/**
 * DevTools Detector Utility
 * Detects when developer tools are opened and shows security warnings
 */

export class DevToolsDetector {
  private isDetectionActive = false;
  private detectionInterval: NodeJS.Timeout | null = null;
  private warningShown = false;

  constructor() {
    this.startDetection();
  }

  private startDetection() {
    if (this.isDetectionActive) return;
    
    this.isDetectionActive = true;
    
    // Method 1: Console detection
    this.detectViaConsole();
    
    // Method 2: Window size detection
    this.detectViaWindowSize();
    
    // Method 3: Performance timing detection
    this.detectViaPerformance();
  }

  private detectViaConsole() {
    const element = new Image();
    
    Object.defineProperty(element, 'id', {
      get: () => {
        this.onDevToolsDetected();
        return 'devtools-detector';
      }
    });
    
    setInterval(() => {
      console.log(element);
      console.clear();
    }, 1000);
  }

  private detectViaWindowSize() {
    setInterval(() => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      if (widthThreshold || heightThreshold) {
        this.onDevToolsDetected();
      }
    }, 500);
  }

  private detectViaPerformance() {
    setInterval(() => {
      const start = performance.now();
      // Performance timing check for devtools detection
      const end = performance.now();
      
      if (end - start > 100) {
        this.onDevToolsDetected();
      }
    }, 1000);
  }

  private onDevToolsDetected() {
    if (this.warningShown) return;
    
    this.warningShown = true;
    
    // Show security warning
    this.showSecurityWarning();
    
    // Optional: Redirect or take other security measures
    this.handleSecurityBreach();
  }

  private showSecurityWarning() {
    // Create a modal-like warning
    const warningDiv = document.createElement('div');
    warningDiv.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      color: #ff4444;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      font-family: Arial, sans-serif;
      font-size: 24px;
      text-align: center;
      flex-direction: column;
    `;
    
    warningDiv.innerHTML = `
      <div style="background: #1a1a1a; padding: 40px; border-radius: 10px; border: 2px solid #ff4444;">
        <h2 style="color: #ff4444; margin-bottom: 20px;">⚠️ AVISO DE SEGURANÇA ⚠️</h2>
        <p style="margin-bottom: 15px;">Ferramentas de desenvolvedor detectadas!</p>
        <p style="margin-bottom: 15px;">Esta aplicação contém informações sensíveis.</p>
        <p style="margin-bottom: 20px;">O acesso não autorizado é monitorado.</p>
        <button id="devtools-warning-dismiss" 
                style="background: #ff4444; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 16px;">
          Entendi
        </button>
      </div>
    `;
    
    document.body.appendChild(warningDiv);
    const dismissBtn = document.getElementById('devtools-warning-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        if (warningDiv.parentElement) {
          warningDiv.remove();
        }
      });
    }
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (warningDiv.parentElement) {
        warningDiv.remove();
      }
    }, 10000);
  }

  private handleSecurityBreach() {
    // Log security event (without sensitive data)
    const securityEvent = {
      timestamp: new Date().toISOString(),
      event: 'devtools_detected',
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    // In a real application, you might want to:
    // 1. Send this to your security monitoring system
    // 2. Temporarily disable certain features
    // 3. Require re-authentication
    // 4. Log the user out after a delay
    
    // For now, we'll just store it locally
    try {
      const existingEvents = JSON.parse(localStorage.getItem('security_events') || '[]');
      existingEvents.push(securityEvent);
      localStorage.setItem('security_events', JSON.stringify(existingEvents));
    } catch {
      // Silently handle localStorage errors
    }
  }

  public stopDetection() {
    this.isDetectionActive = false;
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
  }
}

// Initialize detector
export const initializeDevToolsDetector = () => {
  // Only enable in production
  if (process.env.NODE_ENV === 'production') {
    new DevToolsDetector();
  }
};
