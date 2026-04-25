// ----------------------------------------------------------------------------
// aleo_invoice_example.aleo — anonymous invoice payments
//
// Reference implementation of the on-chain side of architecture-payments.md.
// Pairs with the off-chain encrypted blob stored in Supabase Postgres,
// keyed by the `commitment` field below.
//
// Privacy properties:
// - Identity privacy: payer's record is consumed; nullifier is unlinkable
// - Amount privacy: optional — set `public` modifier off the amount param
//   if you want to hide payment values from observers (this version keeps
//   amount public so the merchant can be paid in public credits, the
//   simpler flow)
// - Metadata privacy: invoice contents live off-chain encrypted; only a
//   BHP256 commitment is on-chain
//
// To use:
//   leo build
//   leo deploy --broadcast --priority-fees 100000
// ----------------------------------------------------------------------------

import credits.aleo;

// Status enum encoded as u8 (Leo doesn't have native enums)
// 0 = Pending, 1 = Paid, 2 = Cancelled
const STATUS_PENDING:   u8 = 0u8;
const STATUS_PAID:      u8 = 1u8;
const STATUS_CANCELLED: u8 = 2u8;

struct InvoiceData {
    merchant: address,
    amount: u64,
    status: u8,
}

program aleo_invoice_example.aleo {

    // commitment (BHP256 hash of canonical invoice JSON) → invoice metadata
    mapping invoices: field => InvoiceData;

    // Private receipt for the payer; proof they paid this invoice.
    record Receipt {
        owner: address,
        commitment: field,
        amount: u64,
    }

    // Merchant calls this to publish a new invoice.
    // The commitment binds the on-chain row to the off-chain encrypted blob.
    fn create_invoice(
        public commitment: field,
        public amount: u64,
    ) -> Final {
        let merchant: address = self.caller;
        return final {
            // Reject duplicate commitments (replay protection).
            assert(!invoices.contains(commitment));
            invoices.set(commitment, InvoiceData {
                merchant: merchant,
                amount: amount,
                status: STATUS_PENDING,
            });
        };
    }

    // Payer calls this to pay an invoice.
    // - Consumes their private credits record (identity privacy)
    // - Produces a private Receipt record (provability for the payer)
    // - Updates the on-chain status to Paid
    // - Forwards public credits to the merchant
    fn pay_invoice(
        public commitment: field,
        payer_credits: credits.aleo/credits,
        public amount: u64,
    ) -> (credits.aleo/credits, Receipt, Final) {
        // Move the payment amount from private (payer) to public (this program).
        let (change, _payment): (credits.aleo/credits, credits.aleo/credits) =
            credits.aleo::transfer_private_to_public(
                payer_credits,
                self.address,
                amount,
            );

        // Mint a private receipt for the payer.
        let receipt: Receipt = Receipt {
            owner: self.caller,
            commitment: commitment,
            amount: amount,
        };

        return (change, receipt, final {
            // Validate the invoice exists, is unpaid, and amount matches.
            let info: InvoiceData = invoices.get(commitment);
            assert_eq(info.status, STATUS_PENDING);
            assert_eq(info.amount, amount);

            // Mark the invoice paid.
            invoices.set(commitment, InvoiceData {
                merchant: info.merchant,
                amount: info.amount,
                status: STATUS_PAID,
            });

            // Pay the merchant in public credits.
            credits.aleo::transfer_public(info.merchant, amount);
        });
    }

    // Merchant can cancel an unpaid invoice.
    fn cancel_invoice(public commitment: field) -> Final {
        let canceller: address = self.caller;
        return final {
            let info: InvoiceData = invoices.get(commitment);
            assert_eq(info.merchant, canceller);
            assert_eq(info.status, STATUS_PENDING);
            invoices.set(commitment, InvoiceData {
                merchant: info.merchant,
                amount: info.amount,
                status: STATUS_CANCELLED,
            });
        };
    }

    // ------------------------------------------------------------------------
    // Tests
    // ------------------------------------------------------------------------

    @test
    fn test_create_invoice() {
        // Note: tests run in a sandboxed VM. self.caller is a fixed test
        // address; substitute with your own address layout if extending.
        let commitment: field = 1234field;
        aleo_invoice_example.aleo::create_invoice(commitment, 100u64);
        // (final-block side effects assert through the runtime; explicit
        //  assertions on storage state require leo-bindings; see /aleo-contract)
    }

    @noupgrade
    constructor() {}
}
