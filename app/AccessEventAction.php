<?php

namespace App;

enum AccessEventAction: string
{
    case RoleChanged = 'role.changed';
    case UserSuspended = 'user.suspended';
    case UserRestored = 'user.restored';
    case FarmerLinked = 'farmer.linked';
    case FarmerUnlinked = 'farmer.unlinked';
    case GrantCreated = 'grant.created';
    case GrantRevoked = 'grant.revoked';
    case AssignmentCreated = 'assignment.created';
    case AssignmentRevoked = 'assignment.revoked';
    case HarvestCorrected = 'harvest.corrected';
    case InventoryReceived = 'inventory.received';
    case InventoryReceiptReversed = 'inventory.receipt_reversed';
    case InventoryBalanceCorrected = 'inventory.balance_corrected';
    case CooperativeRegistered = 'cooperative.registered';
    case CooperativeUpdated = 'cooperative.updated';
    case CooperativeStatusChanged = 'cooperative.status_changed';
    case MembershipStarted = 'membership.started';
    case MembershipSuspended = 'membership.suspended';
    case MembershipReactivated = 'membership.reactivated';
    case MembershipEnded = 'membership.ended';
    case OfficerAssigned = 'officer.assigned';
    case OfficerRevoked = 'officer.revoked';
}
