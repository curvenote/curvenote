import { useFetcher } from 'react-router';
import { Activity, FileBarChart, Play, BoxSelect } from 'lucide-react';
import { ui, primitives, SectionWithHeading } from '@curvenote/scms-core';
import type { CTA } from './types.js';
import { INTENTS } from './types.js';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

const CTAFormFields = forwardRef(function (
  {
    item,
    idx,
    disabled,
    state,
  }: {
    item?: CTA;
    idx: number;
    disabled?: boolean;
    state: 'idle' | 'submitting' | 'loading';
  },
  ref: React.ForwardedRef<any>,
) {
  const [iconValue, setIconValue] = useState(item?.icon ?? 'none');
  useImperativeHandle(ref, () => {
    return {
      reset: () => setIconValue(item?.icon ?? 'none'),
    };
  });

  return (
    <>
      <input type="hidden" name="cta.idx" value={idx} />
      <div className="flex flex-col gap-6">
        <primitives.TextField
          className="w-full"
          disabled={disabled || state !== 'idle'}
          required
          id={`cta.${idx}.label`}
          name="cta.label"
          defaultValue={item?.label ?? ''}
          label="Label"
        />
        <primitives.TextField
          className="w-full"
          disabled={disabled || state !== 'idle'}
          required
          id={`cta.${idx}.url`}
          name="cta.url"
          defaultValue={item?.url ?? ''}
          label="Url"
        />
        <primitives.IconRadioGroup
          id={`cta.${idx}.icon`}
          label="Icon"
          name="cta.icon"
          value={iconValue}
          aria-label="select icon"
          disabled={disabled}
          onValueChange={(v) => setIconValue(v)}
        >
          <primitives.IconRadioItem value="none">
            <BoxSelect className="w-5 h-5 stroke-[1.5px]" />
          </primitives.IconRadioItem>
          <primitives.IconRadioItem value="play">
            <Play className="w-5 h-5 stroke-[1.5px]" />
          </primitives.IconRadioItem>
          <primitives.IconRadioItem value="doc-chart">
            <FileBarChart className="w-5 h-5 stroke-[1.5px]" />
          </primitives.IconRadioItem>
        </primitives.IconRadioGroup>
        <primitives.Checkbox
          id={`cta.${idx}.openInNewTab`}
          name={`cta.openInNewTab`}
          value="true"
          label="Open in new tab"
          disabled={disabled}
          defaultChecked={item?.openInNewTab ?? false}
        />
      </div>
    </>
  );
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AddCTAForm({ idx, label, disabled }: { idx: number; label: string; disabled?: boolean }) {
  const fetcher = useFetcher();
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <div className="flex flex-col gap-6">
      <fetcher.Form ref={formRef} className="flex flex-col gap-4" method="POST">
        <h3 className="text-lg font-light">{label}</h3>
        <CTAFormFields idx={idx} disabled={disabled} state={fetcher.state} />
        <div className="flex justify-end gap-2 pt-4">
          <ui.StatefulButton
            type="submit"
            variant="default"
            name="intent"
            value={INTENTS.ctaAdd}
            title="save changes"
            busy={
              fetcher.state === 'submitting' && fetcher.formData?.get('intent') === INTENTS.ctaSave
            }
            overlayBusy
          >
            Add New
          </ui.StatefulButton>
        </div>
      </fetcher.Form>
    </div>
  );
}

function EditCTAForm({
  idx,
  item,
  label,
  disabled,
}: {
  idx: number;
  item?: CTA;
  label: string;
  disabled?: boolean;
}) {
  const fetcher = useFetcher();
  const ctaFormFieldsRef = useRef(null);
  return (
    <div className="flex flex-col gap-6">
      <fetcher.Form
        className="flex flex-col gap-4"
        method="POST"
        onReset={() => {
          console.log('resetting', ctaFormFieldsRef.current);
          (ctaFormFieldsRef.current as any)?.reset();
        }}
      >
        <h3 className="text-lg font-light">{label}</h3>
        <CTAFormFields
          item={item}
          idx={idx}
          disabled={disabled}
          state={fetcher.state}
          ref={ctaFormFieldsRef}
        />
        <div className="flex justify-end gap-2 pt-4">
          {/* ensure default submit is save on enter */}
          <button
            type="submit"
            name="intent"
            value={INTENTS.ctaSave}
            style={{ display: 'none' }}
            tabIndex={-1}
          ></button>
          {/* <Button
            type="submit"
            variant="outlined"
            name="intent"
            value={INTENTS.ctaRemove}
            title="remove this button"
            loading={
              fetcher.state === 'submitting' &&
              fetcher.formData?.get('intent') === INTENTS.ctaRemove
            }
          >
            Remove
          </Button> */}
          <div className="grow" />
          <ui.StatefulButton
            type="reset"
            variant="outline"
            title="reset form"
            disabled={fetcher.state === 'submitting'}
          >
            Reset
          </ui.StatefulButton>
          <ui.StatefulButton
            type="submit"
            variant="default"
            name="intent"
            value={INTENTS.ctaSave}
            title="save changes"
            busy={
              fetcher.state === 'submitting' && fetcher.formData?.get('intent') === INTENTS.ctaSave
            }
            overlayBusy
          >
            Save
          </ui.StatefulButton>
        </div>
      </fetcher.Form>
    </div>
  );
}

export function EditCTAs({ items }: { items: CTA[] }) {
  return (
    <SectionWithHeading heading="Hero Unit Buttons" icon={Activity}>
      <div className="flex gap-4">
        {items.length > 0 && (
          <primitives.Card lift className="w-1/2 p-6">
            <EditCTAForm idx={0} label="Button 1" item={items[0]} />
          </primitives.Card>
        )}
        {items.length > 1 && (
          <primitives.Card lift className="w-1/2 p-6">
            <EditCTAForm idx={1} label="Button 2" item={items[1]} />
          </primitives.Card>
        )}
      </div>
    </SectionWithHeading>
  );
}
