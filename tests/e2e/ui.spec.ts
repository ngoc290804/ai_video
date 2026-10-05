import { test, expect } from "@playwright/test";
test("browser preview is honest, navigation works, no UI errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Câu chuyện tiếp theo của bạn." }),
  ).toBeVisible();
  await expect(
    page.getByText("Bản xem giao diện", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: "tests/fixtures/home-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Tạo dự án mới", exact: true })
    .click();
  await page.getByRole("button", { name: "Tạo dự án", exact: true }).click();
  await expect(page.getByText("Nhập tên dự án", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  await page.getByRole("link", { name: "Ghép video", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nhiều đoạn phim. Một câu chuyện." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Cài đặt", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Studio theo cách của bạn." }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 700 });
  await page.getByRole("link", { name: "Tổng quan", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Câu chuyện tiếp theo của bạn." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
