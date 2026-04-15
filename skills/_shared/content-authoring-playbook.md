# Shared Content Authoring Playbook

Use this playbook after reading [`content-authoring-rules.md`](./content-authoring-rules.md).

## Fixed Flow

1. Read the smallest relevant scope first.
2. Resolve the exact `id` or `section`.
3. Build the smallest valid mutation payload.
4. Execute one mutation.
5. Re-read the changed target and verify.
6. Summarize the result in Chinese unless the user asked otherwise.

## Stop Conditions

- If two or more items match and the user did not disambiguate, stop.
- If a create request is missing required fields, stop and list the missing fields.
- If the user only provides a local file for a URL-first field, stop and explain that URL upload is not available in this phase.
- If a delete request is implied but not explicit, stop and ask for confirmation.

## Generic Patterns

### Create

- Read the list first to avoid duplicates.
- If no exact target exists, call the matching `create_*` tool with only the required fields plus the explicitly requested optional fields.
- Verify with the matching `get_*` or `list_*` tool.

### Update

- Read first.
- Resolve the stable `id`.
- Patch only the requested fields.
- Verify with a fresh read of the same `id`.

### Delete

- Read first.
- Resolve the stable `id`.
- Delete only when the user explicitly asked for deletion.
- Verify that the deleted target no longer appears in the follow-up read.

## Rejection Templates

### Missing Required Fields

Use this pattern when a create request is incomplete:

> 无法直接写入，当前还缺少必填字段：`<fields>`。补齐这些字段后再执行创建。

### Ambiguous Target

Use this pattern when more than one item could match:

> 当前匹配到多个候选项，不能猜测目标。需要你明确指定稳定 `id`、完整名称，或更准确的筛选条件后再修改。

### URL-First Media

Use this pattern for `pictures` and media fields in other modules:

> 这一步只支持可直接访问的 URL 或已托管路径，不支持把本地文件直接上传到 MCP。请先提供可访问 URL，再继续写入。

### Delete Guard

Use this pattern when the user did not clearly request deletion:

> 这次操作会删除现有数据。请明确确认要删除的目标后，我再执行 `delete_*`。

## Few-Shot Patterns

### Pattern A: Create a new item

- Read: `list_*` with a narrow query.
- Decide: no exact match, required fields complete.
- Mutate: `create_*`.
- Verify: `get_*` by returned `id`.

### Pattern B: Update an existing item

- Read: `list_*` or `get_*`.
- Decide: exactly one target resolved.
- Mutate: `update_*` with the stable `id`.
- Verify: `get_*` again.

### Pattern C: Refuse to guess

- Read: `list_*`.
- Decide: multiple close matches or missing required fields.
- Stop with one of the rejection templates above.
