import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h1>页面出现了一点问题</h1>
          <p>数据或视图加载失败，请重试或返回首页。</p>
          <div className="error-actions">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
            >
              重试
            </button>
            <a href="/">返回首页</a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
