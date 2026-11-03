"""Context payload packing: a block too big for one part is split across consecutive parts that nothing else interrupts."""
import re
import unittest

from insetu.core.gather.engine_gather import _pack_blocks_into_bins

HEADER = "Generated: now\n\nHEADER\n"
CONTINUED = re.compile(r"^Generated: now\n\nHEADER\n(?:=== \(CONTINUED - PART \d+\) ===\n\n)?")


def _read_back(bins):
    """Joins the parts in order with their headers removed, the way a reader stitches a split payload together."""
    return "".join(CONTINUED.sub("", "".join(b["parts"]), count=1) for b in bins)


class TestContextPartPacking(unittest.TestCase):
    def test_split_block_is_read_back_in_one_piece_between_its_neighbours(self):
        max_bytes = 400
        big = "".join(f"line {n:03d} of the big file\n" for n in range(60))
        blocks = ["small A\n", big, "small C\n", "small D\n", "x" * 200 + "\n"]
        bins = _pack_blocks_into_bins(HEADER, blocks, max_bytes)
        self.assertTrue(all(b["size"] <= max_bytes for b in bins), [b["size"] for b in bins])
        self.assertTrue(all(b["size"] == len("".join(b["parts"]).encode("utf-8")) for b in bins))
        text = _read_back(bins)
        self.assertIn(big, text)
        for block in blocks:
            self.assertEqual(text.count(block), 1, block[:20])

    def test_part_numbers_follow_the_order_of_the_parts(self):
        bins = _pack_blocks_into_bins(HEADER, ["y" * 900 + "\n", "small\n"], 400)
        for num, b in enumerate(bins, start=1):
            first = b["parts"][0]
            if num == 1:
                self.assertEqual(first, HEADER)
            else:
                self.assertIn(f"=== (CONTINUED - PART {num}) ===", first)
        self.assertIn("y" * 900 + "\n", _read_back(bins))

    def test_multibyte_text_stays_within_the_byte_limit(self):
        big = "Giữa Chúng Ta — điều đó là thật.\n" * 40
        bins = _pack_blocks_into_bins(HEADER, ["short\n", big], 300)
        self.assertTrue(all(b["size"] <= 300 for b in bins), [b["size"] for b in bins])
        self.assertIn(big, _read_back(bins))

    def test_everything_fits_in_one_part_when_there_is_no_limit(self):
        bins = _pack_blocks_into_bins(HEADER, ["a\n", "b\n"], float("inf"))
        self.assertEqual(len(bins), 1)
        self.assertEqual("".join(bins[0]["parts"]), HEADER + "a\nb\n")


if __name__ == "__main__":
    unittest.main()
