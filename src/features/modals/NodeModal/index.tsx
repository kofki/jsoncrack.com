import React from "react";
import type { ModalProps } from "@mantine/core";
import {
  Modal,
  Stack,
  Text,
  ScrollArea,
  Flex,
  CloseButton,
  Button,
  Textarea,
  Group,
} from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import { modify, applyEdits } from "jsonc-parser";
import useFile from "../../../store/useFile";
import useJson from "../../../store/useJson";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";

// get the value from the full json string at the node path (JSONPath array)
const getValueAtPath = (jsonStr: string, path?: NodeData["path"]) => {
  try {
    const root = JSON.parse(jsonStr);
    if (!path || path.length === 0) return root;

    let cur: any = root;
    for (const seg of path) {
      if (typeof seg === "number") {
        cur = cur?.[seg];
      } else {
        cur = cur?.[seg as string];
      }
      if (typeof cur === "undefined") return undefined;
    }
    return cur;
  } catch (e) {
    return undefined;
  }
};

// fallback formatter: builds a small object from node rows for primitive-only nodes
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj: Record<string, any> = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const json = useJson(state => state.json);

  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState("");

  React.useEffect(() => {
    // reset editing state and editor value when modal opens or selection changes
    setEditing(false);
    // prefer the actual subtree from the current json so nested children are preserved
    const subtree = getValueAtPath(json, nodeData?.path);
    if (typeof subtree !== "undefined") {
      try {
        setValue(
          typeof subtree === "string" ? JSON.stringify(subtree) : JSON.stringify(subtree, null, 2)
        );
      } catch (e) {
        // fallback
        setValue(normalizeNodeData(nodeData?.text ?? []));
      }
    } else {
      setValue(normalizeNodeData(nodeData?.text ?? []));
    }
  }, [opened, nodeData]);

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <Flex align="center" gap="xs">
              {!editing ? (
                <Button size="xs" variant="outline" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              ) : (
                <Group spacing="xs">
                  <Button
                    size="xs"
                    color="green"
                    onClick={() => {
                      // attempt to parse the edited value
                      let newValue: any = value;
                      try {
                        newValue = JSON.parse(value);
                      } catch (err) {
                        newValue = value;
                      }

                      try {
                        const path = nodeData?.path ?? [];
                        const edits = modify(json, path as any, newValue, {
                          formattingOptions: { insertSpaces: true, tabSize: 2 },
                        });
                        const newJson = applyEdits(json, edits);
                        useJson.getState().setJson(newJson);
                        // update the left-hand editor contents so sidebar reflects change
                        useFile.getState().setContents({ contents: newJson, hasChanges: true });
                        setEditing(false);
                        onClose?.();
                      } catch (e) {
                        console.error("Failed to apply edit", e);
                      }
                    }}
                  >
                    Save
                  </Button>
                  <Button
                    size="xs"
                    color="gray"
                    variant="outline"
                    onClick={() => {
                      setEditing(false);
                      // restore the actual subtree value from current json
                      const subtree = getValueAtPath(json, nodeData?.path);
                      if (typeof subtree !== "undefined") {
                        try {
                          setValue(
                            typeof subtree === "string"
                              ? JSON.stringify(subtree)
                              : JSON.stringify(subtree, null, 2)
                          );
                        } catch (e) {
                          setValue(normalizeNodeData(nodeData?.text ?? []));
                        }
                      } else {
                        setValue(normalizeNodeData(nodeData?.text ?? []));
                      }
                    }}
                  >
                    Cancel
                  </Button>
                </Group>
              )}
              <CloseButton onClick={onClose} />
            </Flex>
          </Flex>
          <ScrollArea.Autosize mah={250} maw={600}>
            {!editing ? (
              <CodeHighlight
                code={value || normalizeNodeData(nodeData?.text ?? [])}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            ) : (
              <Textarea
                value={value}
                onChange={e => setValue(e.currentTarget.value)}
                autosize
                minRows={4}
                maxRows={20}
                styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
              />
            )}
          </ScrollArea.Autosize>
        </Stack>
        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};
