import { useState } from "react";
import "./App.css";

function App() {
	const [count, setCount] = useState(0);

	return (
		<div className="App">
			<header className="App-header">
				<h1>ServerlessMQ Frontend</h1>
				<p>欢迎使用 ServerlessMQ 消息队列系统</p>
				<div className="card">
					<button onClick={() => setCount((count) => count + 1)}>
						count is {count}
					</button>
					<p>这是一个基于React的单页应用示例</p>
				</div>
			</header>
		</div>
	);
}

export default App;
