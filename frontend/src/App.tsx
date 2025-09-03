import { useState, useEffect } from "react";
import {
	FluentProvider,
	webLightTheme,
	webDarkTheme,
	Button,
	Text,
	Card,
	CardHeader,
	Body1,
	Input,
	Select,
	Table,
	TableHeader,
	TableRow,
	TableHeaderCell,
	TableBody,
	TableCell,
	Spinner,
	Toast,
	ToastTitle,
	ToastBody,
	useToastController,
	Toaster,
	Field,
	Badge,
	Switch,
	makeStyles,
} from "@fluentui/react-components";
import {
	DarkTheme24Regular,
	WeatherMoon24Regular,
	Eye24Regular,
	ArrowCounterclockwise24Regular,
	Filter24Regular,
} from "@fluentui/react-icons";
import "./App.css";

interface LogEntry {
	id: number;
	topic: string;
	event_type: string;
	timestamp: string;
	client_ip?: string;
	client_headers?: Record<string, any>;
	data?: any;
	created_at: string;
}

interface LogsResponse {
	success: boolean;
	logs: LogEntry[];
	total_count: number;
	pagination: {
		limit: number;
		offset: number;
		has_more: boolean;
	};
}

const useStyles = makeStyles({
	container: {
		padding: "20px",
		maxWidth: "1200px",
		margin: "0 auto",
	},
	header: {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: "20px",
	},
	authCard: {
		marginBottom: "20px",
		padding: "20px",
	},
	filterCard: {
		marginBottom: "20px",
		padding: "15px",
	},
	filterRow: {
		display: "flex",
		gap: "15px",
		flexWrap: "wrap",
		alignItems: "end",
	},
	logsCard: {
		padding: "20px",
	},
	logTable: {
		width: "100%",
	},
	eventBadge: {
		fontSize: "12px",
	},
	jsonView: {
		backgroundColor: "var(--colorNeutralBackground2)",
		padding: "10px",
		borderRadius: "4px",
		fontFamily: "monospace",
		fontSize: "12px",
		maxHeight: "200px",
		overflow: "auto",
		whiteSpace: "pre-wrap",
	},
	pagination: {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		marginTop: "20px",
	},
});

function App() {
	const styles = useStyles();
	const { dispatchToast } = useToastController();

	// Theme state
	const [isDarkMode, setIsDarkMode] = useState(() => {
		// Auto-detect dark mode preference
		if (typeof window !== "undefined") {
			return window.matchMedia("(prefers-color-scheme: dark)").matches;
		}
		return false;
	});

	// Authentication state
	const [topic, setTopic] = useState("");
	const [password, setPassword] = useState("");
	const [isAuthenticated, setIsAuthenticated] = useState(false);

	// Logs state
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const [totalCount, setTotalCount] = useState(0);
	const [currentPage, setCurrentPage] = useState(0);
	const [pageSize] = useState(50);

	// Filter state
	const [eventTypeFilter, setEventTypeFilter] = useState("");
	const [startTime, setStartTime] = useState("");
	const [endTime, setEndTime] = useState("");

	// Auto-detect theme changes
	useEffect(() => {
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleChange = (e: MediaQueryListEvent) => {
			setIsDarkMode(e.matches);
		};

		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, []);

	const showToast = (
		title: string,
		message: string,
		intent: "success" | "error" | "warning" = "success"
	) => {
		dispatchToast(
			<Toast>
				<ToastTitle>{title}</ToastTitle>
				<ToastBody>{message}</ToastBody>
			</Toast>,
			{ intent }
		);
	};

	const authenticate = async () => {
		if (!topic.trim() || !password.trim()) {
			showToast("验证失败", "请输入主题名称和密码", "error");
			return;
		}

		setLoading(true);
		try {
			const response = await fetch(
				`/${topic}/logs?password=${encodeURIComponent(password)}&limit=1&offset=0`
			);

			if (response.ok) {
				setIsAuthenticated(true);
				showToast("验证成功", `已连接到主题 ${topic}`, "success");
				fetchLogs(0);
			} else {
				const error = await response.json();
				showToast("验证失败", error.message || "无效的主题密码", "error");
			}
		} catch (error) {
			showToast("连接错误", "无法连接到服务器", "error");
		} finally {
			setLoading(false);
		}
	};

	const fetchLogs = async (page: number = currentPage) => {
		if (!isAuthenticated) return;

		setLoading(true);
		try {
			const params = new URLSearchParams({
				password,
				limit: pageSize.toString(),
				offset: (page * pageSize).toString(),
			});

			if (eventTypeFilter) params.append("event_type", eventTypeFilter);
			if (startTime) params.append("start_time", startTime);
			if (endTime) params.append("end_time", endTime);

			const response = await fetch(`/${topic}/logs?${params}`);

			if (response.ok) {
				const data: LogsResponse = await response.json();
				setLogs(data.logs);
				setTotalCount(data.total_count);
				setCurrentPage(page);
			} else {
				const error = await response.json();
				showToast("获取日志失败", error.message, "error");
			}
		} catch (error) {
			showToast("网络错误", "无法获取日志数据", "error");
		} finally {
			setLoading(false);
		}
	};

	const logout = () => {
		setIsAuthenticated(false);
		setTopic("");
		setPassword("");
		setLogs([]);
		setCurrentPage(0);
		setEventTypeFilter("");
		setStartTime("");
		setEndTime("");
	};

	const formatTimestamp = (timestamp: string) => {
		return new Date(timestamp).toLocaleString("zh-CN");
	};

	const getEventTypeBadge = (eventType: string) => {
		const colors = {
			webhook: "success",
			websocket_connect: "brand",
			websocket_message: "informative",
			websocket_disconnect: "warning",
		} as const;

		return (
			<Badge
				appearance="filled"
				color={colors[eventType as keyof typeof colors] || "subtle"}
				className={styles.eventBadge}
			>
				{eventType}
			</Badge>
		);
	};

	const formatJsonData = (data: any) => {
		if (!data) return "null";
		return JSON.stringify(data, null, 2);
	};

	const currentTheme = isDarkMode ? webDarkTheme : webLightTheme;

	return (
		<FluentProvider theme={currentTheme}>
			<Toaster />
			<div className={styles.container}>
				<div className={styles.header}>
					<Text as="h1" size={800}>
						ServerlessMQ 日志查看器
					</Text>
					<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
						<Switch
							checked={isDarkMode}
							onChange={(_, data) => setIsDarkMode(data.checked)}
							label={isDarkMode ? "暗色模式" : "亮色模式"}
						/>
						{isDarkMode ? <DarkTheme24Regular /> : <WeatherMoon24Regular />}
					</div>
				</div>

				{!isAuthenticated ? (
					<Card className={styles.authCard}>
						<CardHeader>
							<Text weight="semibold" size={500}>
								<Eye24Regular style={{ marginRight: "8px" }} />
								主题认证
							</Text>
						</CardHeader>
						<Body1 style={{ marginBottom: "15px" }}>
							请输入主题名称和对应的密码来查看日志
						</Body1>
						<div
							style={{
								display: "flex",
								gap: "15px",
								flexWrap: "wrap",
								alignItems: "end",
							}}
						>
							<Field label="主题名称" required>
								<Input
									value={topic}
									onChange={(_, data) => setTopic(data.value)}
									placeholder="例如: MC"
									disabled={loading}
								/>
							</Field>
							<Field label="密码" required>
								<Input
									type="password"
									value={password}
									onChange={(_, data) => setPassword(data.value)}
									placeholder="输入主题密码"
									disabled={loading}
									onKeyDown={(e) => e.key === "Enter" && authenticate()}
								/>
							</Field>
							<Button
								appearance="primary"
								onClick={authenticate}
								disabled={loading || !topic.trim() || !password.trim()}
							>
								{loading ? <Spinner size="tiny" /> : "连接"}
							</Button>
						</div>
					</Card>
				) : (
					<>
						<Card className={styles.filterCard}>
							<div
								style={{
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
									marginBottom: "15px",
								}}
							>
								<Text weight="semibold" size={400}>
									<Filter24Regular style={{ marginRight: "8px" }} />
									过滤选项 - 主题: {topic}
								</Text>
								<Button appearance="subtle" onClick={logout}>
									退出登录
								</Button>
							</div>
							<div className={styles.filterRow}>
								<Field label="事件类型">
									<Select
										value={eventTypeFilter}
										onChange={(_, data) => setEventTypeFilter(data.value)}
									>
										<option value="">全部</option>
										<option value="webhook">Webhook</option>
										<option value="websocket_connect">WebSocket连接</option>
										<option value="websocket_message">WebSocket消息</option>
										<option value="websocket_disconnect">WebSocket断开</option>
									</Select>
								</Field>
								<Field label="开始时间">
									<Input
										type="datetime-local"
										value={startTime}
										onChange={(_, data) => setStartTime(data.value)}
									/>
								</Field>
								<Field label="结束时间">
									<Input
										type="datetime-local"
										value={endTime}
										onChange={(_, data) => setEndTime(data.value)}
									/>
								</Field>
								<Button
									appearance="primary"
									onClick={() => fetchLogs(0)}
									disabled={loading}
								>
									<Filter24Regular style={{ marginRight: "4px" }} />
									筛选
								</Button>
								<Button
									appearance="subtle"
									onClick={() => fetchLogs()}
									disabled={loading}
								>
									<ArrowCounterclockwise24Regular
										style={{ marginRight: "4px" }}
									/>
									刷新
								</Button>
							</div>
						</Card>

						<Card className={styles.logsCard}>
							<div
								style={{
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
									marginBottom: "15px",
								}}
							>
								<Text weight="semibold" size={500}>
									日志记录 ({totalCount} 条)
								</Text>
								{loading && <Spinner size="small" />}
							</div>

							{logs.length === 0 && !loading ? (
								<Body1
									style={{
										textAlign: "center",
										padding: "40px",
										color: "var(--colorNeutralForeground3)",
									}}
								>
									暂无日志记录
								</Body1>
							) : (
								<>
									<Table className={styles.logTable}>
										<TableHeader>
											<TableRow>
												<TableHeaderCell>时间</TableHeaderCell>
												<TableHeaderCell>事件类型</TableHeaderCell>
												<TableHeaderCell>客户端IP</TableHeaderCell>
												<TableHeaderCell>数据</TableHeaderCell>
											</TableRow>
										</TableHeader>
										<TableBody>
											{logs.map((log) => (
												<TableRow key={log.id}>
													<TableCell>
														<Text
															size={200}
															style={{ fontFamily: "monospace" }}
														>
															{formatTimestamp(log.timestamp)}
														</Text>
													</TableCell>
													<TableCell>
														{getEventTypeBadge(log.event_type)}
													</TableCell>
													<TableCell>
														<Text
															size={200}
															style={{ fontFamily: "monospace" }}
														>
															{log.client_ip || "-"}
														</Text>
													</TableCell>
													<TableCell>
														<div className={styles.jsonView}>
															{formatJsonData(log.data)}
														</div>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>

									<div className={styles.pagination}>
										<Text size={200}>
											显示第 {currentPage * pageSize + 1} -{" "}
											{Math.min((currentPage + 1) * pageSize, totalCount)}{" "}
											条，共 {totalCount} 条
										</Text>
										<div style={{ display: "flex", gap: "10px" }}>
											<Button
												appearance="subtle"
												disabled={currentPage === 0 || loading}
												onClick={() => fetchLogs(currentPage - 1)}
											>
												上一页
											</Button>
											<Button
												appearance="subtle"
												disabled={
													!logs.length ||
													(currentPage + 1) * pageSize >= totalCount ||
													loading
												}
												onClick={() => fetchLogs(currentPage + 1)}
											>
												下一页
											</Button>
										</div>
									</div>
								</>
							)}
						</Card>
					</>
				)}
			</div>
		</FluentProvider>
	);
}

export default App;
