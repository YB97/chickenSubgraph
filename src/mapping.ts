import { BigInt } from "@graphprotocol/graph-ts"
import {
  FryCook,
  Deposit,
  EmergencyWithdraw,
  RoleAdminChanged,
  RoleGranted,
  RoleRevoked,
  Withdraw,
  AddCall,
  MigrateCall,
  SetCall
} from "../generated/FryCook/FryCook"
import { FryCook as FryCookEntity, FryCookPool, FryCookPoolData } from "../generated/schema"

// Exchange identifiers. Integers to save space in historical data.
const EXCHANGE_UNISWAP = 0;
const EXCHANGE_CHICKEN = 1;

// Seconds apart between stored data entries.
const dataInterval = 60 * 15;


function getFryCookEntity(): FryCookEntity {
  let entity = FryCookEntity.load("1");

  if (entity === null) {
    entity = new FryCookEntity("1");
    entity.totalAllocPoint = BigInt.fromI32(0);
    entity.save();
  }

  return entity as FryCookEntity;
}

function updatePoolData(pool: FryCookPool, timestamp: i32): void {
  let quarterHourIndex = (timestamp / dataInterval) * dataInterval;
  let poolDataId = pool.id + "-" + quarterHourIndex.toString();
  let poolData = FryCookPoolData.load(poolDataId);

  if (poolData === null) {
    poolData = new FryCookPoolData(poolDataId);
    poolData.pool = pool.id;
    poolData.timestamp = timestamp;
  }

  let totalAllocPoint = getFryCookEntity().totalAllocPoint;
  poolData.allocShare = pool.allocPoint
    .times(BigInt.fromI32(10).pow(12))
    .div(totalAllocPoint);
  poolData.balance = pool.balance;
  poolData.exchange = pool.exchange;

  poolData.save();
}

export function handleDeposit(event: Deposit): void {
  let pool = FryCookPool.load(event.params.pid.toString());
  pool.balance = pool.balance.plus(event.params.amount);
  pool.save();

  updatePoolData(pool as FryCookPool, event.block.timestamp.toI32());
}

export function handleEmergencyWithdraw(event: EmergencyWithdraw): void {
  let pool = FryCookPool.load(event.params.pid.toString());
  pool.balance = pool.balance.minus(event.params.amount);
  pool.save();

  updatePoolData(pool as FryCookPool, event.block.timestamp.toI32());
}

export function handleRoleAdminChanged(event: RoleAdminChanged): void {}

export function handleRoleGranted(event: RoleGranted): void {}

export function handleRoleRevoked(event: RoleRevoked): void {}

export function handleWithdraw(event: Withdraw): void {
  let pool = FryCookPool.load(event.params.pid.toString());
  pool.balance = pool.balance.minus(event.params.amount);
  pool.save();

  updatePoolData(pool as FryCookPool, event.block.timestamp.toI32());
}


export function handleAddPool(event: AddCall): void {
  let fryCook = FryCook.bind(event.to);

  let poolId = fryCook.poolLength().minus(BigInt.fromI32(1));
  let poolInfo = fryCook.poolInfo(poolId);

  let pool = new FryCookPool(poolId.toString());
  pool.balance = BigInt.fromI32(0);
  pool.lpToken = poolInfo.value0;
  pool.allocPoint = poolInfo.value1;
  pool.lastRewardBlock = poolInfo.value2;
  pool.accChickenPerScore = poolInfo.value3;
  pool.exchange = EXCHANGE_UNISWAP;
  pool.addedAt = event.block.timestamp.toI32();
  pool.save();

  let fryCookEntity = getFryCookEntity();
  fryCookEntity.totalAllocPoint = fryCookEntity.totalAllocPoint.plus(
    pool.allocPoint
  );
  fryCookEntity.save();
}

export function handleSetPoolAllocPoint(event: SetCall): void {
  let pool = FryCookPool.load(event.inputs._pid.toString());

  let fryCookEntity = getFryCookEntity();
  fryCookEntity.totalAllocPoint = fryCookEntity.totalAllocPoint.plus(
    event.inputs._allocPoint.minus(pool.allocPoint)
  );
  fryCookEntity.save();

  pool.allocPoint = event.inputs._allocPoint;
  pool.save();
}

export function handleMigrate(event: MigrateCall): void {
  let fryCook = FryCook.bind(event.to);

  let pool = FryCookPool.load(event.inputs._pid.toString());
  pool.lpToken = fryCook.poolInfo(event.inputs._pid).value0;
  pool.exchange = EXCHANGE_CHICKEN;
  pool.save();

  updatePoolData(pool as FryCookPool, event.block.timestamp.toI32());
}

