import React, { useContext, useMemo, useCallback } from 'react'
import { useHistory } from 'react-router-dom';

import { Button, DataView } from '@aragon/ui'
import BigNumber from 'bignumber.js'

import { walletContext } from '../../contexts/wallet'
import { Controller } from '../../utils/contracts/controller'
import { SubgraphVault } from '../../types'
import SectionTitle from '../../components/SectionHeader'
import TokenAddress from '../../components/TokenAddress'
import Status from '../../components/DataViewStatusEmpty'
import { ZERO_ADDR } from '../../constants/addresses'
import { useTokenByAddress} from '../../hooks/useToken'
import { toTokenAmount } from '../../utils/math'

type VaultSectionProps = { account: string, isLoading: boolean, vaults: SubgraphVault[] }

export default function VaultSection({ account, vaults, isLoading }: VaultSectionProps ) {
  const { web3, networkId, user } = useContext(walletContext)

  const controller = useMemo(() => new Controller(web3, networkId, user), [networkId, user, web3])
  const history =  useHistory()
  const openVault = useCallback(async() => {
    await controller.openVault(account)
  }, [account, controller])

  const collateralToken = useTokenByAddress(vaults.length > 0 && vaults[0].collateralAsset ? vaults[0].collateralAsset.id : ZERO_ADDR, networkId)

  const renderRow = useCallback((vault: SubgraphVault, index) => {
    const collateralAmount = vault.collateralAmount ? vault.collateralAmount : '0'
    const longAmount = vault.longAmount ? vault.longAmount : '0'
    const shortAmount = vault.shortAmount ? vault.shortAmount : '0'
    return [
      <TokenAddress token={vault.collateralAsset} />,
      toTokenAmount(new BigNumber(collateralAmount), collateralToken.decimals).toString(),
      <TokenAddress token={vault.longOToken} />,
      toTokenAmount(new BigNumber(longAmount), 8).toString(),
      <TokenAddress token={vault.shortOToken} />,
      toTokenAmount(new BigNumber(shortAmount), 8).toString(),
      <Button label={"Detail"} onClick={()=>{ history.push(`/vault/${account}/${index + 1}`);}} />
    ]
  }, [account, collateralToken.decimals, history])

  return (
    <>
      <SectionTitle title="Vaults" />
      <Button label={"Open new Vault"} onClick={() => openVault()} />
      <br/><br/>
      <DataView
        status={isLoading ? 'loading' : 'default'}
        fields={['Collateral', 'amount', 'Long', 'amount', 'Short', 'amount', '']}
        statusEmpty={<Status label={"No vaults"} />}
        entries={vaults}
        renderEntry={renderRow}
      />
      
    </>
  )
}
