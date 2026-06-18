import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Drawer } from "@/components/ui/drawer";

describe("workbench drawer integration", () => {
  it("renders as a modal portal and closes on Escape", () => {
    const onClose = vi.fn();
    render(<Drawer open onClose={onClose} title="Smart assistance" description="Review suggestions"><button>Apply</button></Drawer>);
    expect(screen.getByRole("dialog", { name: "Smart assistance" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Apply" })).toBeVisible();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
