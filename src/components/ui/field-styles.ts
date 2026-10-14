// Class strings shared by every form control, native or custom, so a text box, a dropdown and a
// date picker always look like one family (cream field, green focus ring).

export const LABEL = "block font-label-md text-label-md font-semibold text-[#2A2622]";

export const FIELD =
  "w-full rounded-lg border border-[#2A2622]/15 bg-[#FFFDF9] px-3.5 py-2.5 font-body-md text-body-md text-[#2A2622] outline-none transition-all placeholder:text-[#2A2622]/35 focus:border-[#1F4D3D] focus:shadow-[0_0_0_3px_rgba(31,77,61,0.08)] disabled:opacity-60";

export const FIELD_AUTO = FIELD.replace("w-full", "w-auto min-w-36");

export const FIELD_SM = FIELD.replace("font-body-md text-body-md", "font-body-sm text-body-sm");
