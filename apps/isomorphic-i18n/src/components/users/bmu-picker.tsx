import { Button } from "@workspace/ui/components/button";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
} from "@workspace/ui/components/combobox";

export type BmuOption = { value: string; label: string; group: string };
export type BmuGroup = { value: string; items: BmuOption[] };

/** Group BMU documents by their `group`, keeping first-seen group order. */
export function groupBmus(bmus: { _id: unknown; BMU: string; group: string }[] | undefined): BmuGroup[] {
  const groups = new Map<string, BmuOption[]>();
  for (const bmu of bmus ?? []) {
    const items = groups.get(bmu.group) ?? [];
    items.push({ value: String(bmu._id), label: bmu.BMU, group: bmu.group });
    groups.set(bmu.group, items);
  }
  return Array.from(groups, ([value, items]) => ({ value, items }));
}

const sameBmu = (a: BmuOption, b: BmuOption) => a.value === b.value;

function GroupedList({ groups, action }: { groups: BmuGroup[]; action?: (group: BmuGroup) => React.ReactNode }) {
  return (
    <ComboboxList>
      {(group: BmuGroup, index: number) => (
        <ComboboxGroup key={group.value} items={group.items}>
          <ComboboxLabel className="flex items-center justify-between">
            {group.value}
            {action?.(group)}
          </ComboboxLabel>
          <ComboboxCollection>
            {(option: BmuOption) => (
              <ComboboxItem key={option.value} value={option}>
                {option.label}
              </ComboboxItem>
            )}
          </ComboboxCollection>
          {index < groups.length - 1 && <ComboboxSeparator />}
        </ComboboxGroup>
      )}
    </ComboboxList>
  );
}

export function BmuMultiPicker({
  id,
  groups,
  value,
  onChange,
  invalid,
}: {
  id?: string;
  groups: BmuGroup[];
  value: BmuOption[];
  onChange: (value: BmuOption[]) => void;
  invalid?: boolean;
}) {
  const toggleGroup = (group: BmuGroup) => {
    const allSelected = group.items.every((o) => value.some((v) => sameBmu(v, o)));
    onChange(
      allSelected
        ? value.filter((v) => !group.items.some((o) => sameBmu(v, o)))
        : [...value, ...group.items.filter((o) => !value.some((v) => sameBmu(v, o)))]
    );
  };

  return (
    <Combobox
      items={groups}
      multiple
      value={value}
      onValueChange={onChange}
      itemToStringValue={(o: BmuOption) => o.label}
      isItemEqualToValue={sameBmu}
    >
      <ComboboxTrigger
        id={id}
        render={<Button variant="outline" className="w-full justify-between font-normal" aria-invalid={invalid} />}
      >
        {value.length ? `${value.length} BMU${value.length > 1 ? "s" : ""} selected` : "Select BMUs"}
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxInput showTrigger={false} placeholder="Search BMUs" />
        <ComboboxEmpty>No BMUs found.</ComboboxEmpty>
        <GroupedList
          groups={groups}
          action={(group) => (
            <Button variant="ghost" size="xs" onClick={() => toggleGroup(group)}>
              {group.items.every((o) => value.some((v) => sameBmu(v, o))) ? "Clear" : "All"}
            </Button>
          )}
        />
      </ComboboxContent>
    </Combobox>
  );
}

export function BmuSinglePicker({
  id,
  groups,
  value,
  onChange,
}: {
  id?: string;
  groups: BmuGroup[];
  value: BmuOption | null;
  onChange: (value: BmuOption | null) => void;
}) {
  return (
    <Combobox
      items={groups}
      value={value}
      onValueChange={onChange}
      itemToStringValue={(o: BmuOption) => o.label}
      isItemEqualToValue={sameBmu}
    >
      <ComboboxTrigger id={id} render={<Button variant="outline" className="w-full justify-between font-normal" />}>
        {value?.label ?? "Select a BMU"}
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxInput showTrigger={false} placeholder="Search BMUs" />
        <ComboboxEmpty>No BMUs found.</ComboboxEmpty>
        <GroupedList groups={groups} />
      </ComboboxContent>
    </Combobox>
  );
}
