// Provider seam: replace this mock with an SMS adapter before real production use.
// No code is logged. Production deliberately has no mock code retrieval path.
export async function deliverPhoneOtp({ code, runtimeMode }) {
  return ["development", "test"].includes(runtimeMode)
    ? { mockCode: code }
    : {};
}
