import type {
	AlterTableColumnAlteringBuilder,
	ColumnBuilderCallback,
	Kysely,
} from "kysely";
import { sql } from "kysely";
import type { ColumnDataType } from "kysely";
import {
	ZodBoolean,
	ZodDate,
	ZodNumber,
	type ZodRawShape,
	ZodString,
	type ZodType,
	ZodTypeAny,
	ZodTypeDef,
	type z,
} from "zod";
import { ZodArray, ZodBigInt, ZodDefault, ZodNullable, ZodEnum } from "zod";
import { ZodOptional } from "zod";

function toSqlType(
	type: ZodType,
	metadata: {
		notNull: boolean;
		defaultValue?: unknown;
	} = {
		notNull: true,
		defaultValue: undefined,
	}
): {
	sqlType: ColumnDataType;
	notNull: boolean;
	defaultValue?: unknown;
} {
	// 基础类型映射表
	type ZodConstructor = abstract new (def: never) => ZodTypeAny;
	const baseTypeMap: [ZodConstructor, ColumnDataType][] = [
		[ZodString, "text"],
		[ZodDate, "datetime"],
		[ZodBoolean, "boolean"],
		[ZodBigInt, "bigint"],
		[ZodArray, "json"],
		[ZodEnum, "text"],
	];

	// 命中基础类型
	for (const [zodCls, sqlType] of baseTypeMap) {
		if (type instanceof zodCls) return { ...metadata, sqlType };
	}
	if (type instanceof ZodNumber) {
		const numberDef = type._def;
		if (numberDef.checks) {
			for (const check of numberDef.checks) {
				if (check.kind === "int") {
					return { ...metadata, sqlType: "integer" };
				}
			}
		}
		return { ...metadata, sqlType: "real" };
	}

	if (type instanceof ZodOptional) {
		return toSqlType(type._def.innerType, {
			...metadata,
			notNull: false,
		});
	}
	if (type instanceof ZodNullable) {
		return toSqlType(type._def.innerType, {
			...metadata,
			notNull: false,
		});
	}
	if (type instanceof ZodDefault) {
		return toSqlType(type._def.innerType, {
			...metadata,
			defaultValue: type._def.defaultValue(),
		});
	}
	throw new Error(`Unsupported type: ${type.constructor.name}`);
}
export async function createTable<
	DB,
	T extends keyof DB & string,
	R extends ZodRawShape = ZodRawShape,
>(
	db: Kysely<DB>,
	tableName: T,
	schema: z.ZodObject<R>,
	buildList?: {
		[K in keyof z.infer<z.ZodObject<R>>]?: ColumnBuilderCallback;
	}
) {
	let sql = db.schema.createTable(tableName).ifNotExists();
	for (const [name, type] of Object.entries(schema.shape)) {
		const { notNull, sqlType, defaultValue } = toSqlType(type);
		sql = sql.addColumn(name, sqlType, (col) => {
			if (notNull) col = col.notNull();
			if (defaultValue !== undefined) col = col.defaultTo(defaultValue);
			const extraFunc = buildList?.[name];
			if (extraFunc) return extraFunc(col);
			return col;
		});
	}
	await sql.execute();
}
export type BuildListType<R extends ZodRawShape> = {
	[K in keyof z.infer<z.ZodObject<R>>]?: ColumnBuilderCallback;
};
export async function checkTable<
	DB,
	T extends keyof DB & string,
	R extends ZodRawShape = ZodRawShape,
>(
	db: Kysely<DB>,
	tableName: T,
	schema: z.ZodObject<R>,
	buildList?: BuildListType<R>,
	autoRemoveColumns = false
) {
	const columns = Object.entries(schema.shape).map(
		([name, type]: [string, ZodType]) =>
			[name, toSqlType(type)] as [string, ReturnType<typeof toSqlType>]
	);
	// const sql = `PRAGMA table_info(${tableName})`;
	const { rows: result } = await sql<{
		cid: number;
		name: string;
		type: string;
		notnull: number;
		dflt_value: string | null;
		pk: number;
	}>`PRAGMA table_info(${sql.lit(tableName)});`.execute(db);
	console.log(JSON.stringify(result));
	// const result = (await db.selectNoFrom(sql<string>"").all()).results;
	if (result.length === 0) {
		// If the table does not exist, create it
		await createTable(db, tableName, schema, buildList);
		return;
	}

	const columnNames = result.map((row) => row.name);
	const missingColumns = columns.filter(
		// Compare the columns
		([columnName, _]) => !columnNames.includes(columnName)
	);
	// const diffTypes = columns.filter(
	// 	([columnName, { sqlType: columnType, notNull, defaultValue }]) => {
	// 		const existingColumn = result.find((row) => row.name === columnName);
	// 		if (!existingColumn) return false;
	// 		if (
	// 			existingColumn.type.toLowerCase() !== String(columnType).toLowerCase()
	// 		)
	// 			return true;
	// 		if ((existingColumn.notnull === 1) !== notNull) return true;
	// 		console.log(existingColumn.dflt_value);
	// 		console.log(defaultValue);
	// 		return false;
	// 	}
	// );
	const removeColumns = autoRemoveColumns
		? columnNames.filter((columnName) => {
				return !columns.find(([name, _]) => name === columnName);
			})
		: [];
	if (
		missingColumns.length > 0 ||
		// diffTypes.length > 0 ||
		removeColumns.length > 0
	) {
		function alter(
			func: (
				a: ReturnType<typeof db.schema.alterTable>
			) => ReturnType<ReturnType<typeof db.schema.alterTable>["addColumn"]>
		) {
			return func(db.schema.alterTable(tableName)).execute();
		}
		for (const [
			columnName,
			{ sqlType: columnType, notNull, defaultValue },
		] of missingColumns) {
			await alter((a) =>
				a.addColumn(columnName, columnType, (col) => {
					if (notNull) col = col.notNull();
					if (defaultValue !== undefined) col = col.defaultTo(defaultValue);
					const extraFunc = buildList?.[columnName];
					if (extraFunc) return extraFunc(col);
					return col;
				})
			);
		}
		// for (const [
		// 	columnName,
		// 	{ sqlType: columnType, notNull, defaultValue },
		// ] of diffTypes) {
		// 	alter((a) => a.modifyColumn(columnName, columnType))

		// 		.alterColumn(columnName, (col) =>
		// 			notNull ? col.setNotNull() : col.dropNotNull()
		// 		)
		// 		.alterColumn(columnName, (col) =>
		// 			defaultValue !== undefined
		// 				? col.setDefault(defaultValue)
		// 				: col.dropDefault()
		// 		);
		// }
		for (const columnName of removeColumns) {
			alter((a) => a.dropColumn(columnName));
		}
	}
}
