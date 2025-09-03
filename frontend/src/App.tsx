import { useState } from "react";
import {
	FluentProvider,
	webLightTheme,
	Button,
	Text,
	Card,
	CardHeader,
	Body1,
} from "@fluentui/react-components";
import "./App.css";

function App() {
	const [count, setCount] = useState(0);

	return (
		<FluentProvider theme={webLightTheme}>
			<div className="App">
				<header className="App-header">
					<Text as="h1" size={800}>
						ServerlessMQ Frontend
					</Text>
					<Body1>欢迎使用 ServerlessMQ 消息队列系统</Body1>
					<Card style={{ margin: "20px", padding: "20px" }}>
						<CardHeader>
							<Text weight="semibold">计数器示例</Text>
						</CardHeader>
						<Button
							appearance="primary"
							onClick={() => setCount((count) => count + 1)}
							style={{ marginTop: "10px" }}
						>
							count is {count}
						</Button>
						<Body1 style={{ marginTop: "10px" }}>
							这是一个基于React 18和FluentUI的单页应用示例
						</Body1>
					</Card>
				</header>
			</div>
		</FluentProvider>
	);
}

export default App;
