import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[renderer]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-boot error">
          <h1>界面出现异常</h1>
          <p>{this.state.error.message || String(this.state.error)}</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>重新加载</button>
        </div>
      );
    }
    return this.props.children;
  }
}
